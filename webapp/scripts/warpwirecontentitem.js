/**********************************************************************
//
// Warpwire Sakai Plugin - portal renderer / playback
//
// Copyright 2026 Warpwire, Inc Licensed under the
//  Educational Community License, Version 2.0 (the "License"); you may
//  not use this file except in compliance with the License. You may
//  obtain a copy of the License at
//
// http://www.opensource.org/licenses/ECL-2.0
//
//  Unless required by applicable law or agreed to in writing,
//  software distributed under the License is distributed on an "AS IS"
//  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
//  or implied. See the License for the specific language governing
//  permissions and limitations under the License.
//
// -------------------------------------------------------------------
// Finds embedded Warpwire media on rendered portal pages and renders each
// embed so it authenticates and plays on Sakai 25. The plugin version lives in
// the shared runtime (portal/scripts/warpwire.js, WARPWIRE.version) - not here.
//
// Design (see openspec design.md D2/D3/D6):
//   * Restricted media is served by a self-authenticating LTI 1.1 content-item
//     launch: the embed's iframe src IS the stored launch URL, which
//     authenticates and serves the media in one round trip. There is NO hidden
//     login iframe primed off scraped portal-nav markup, and NO cross-site
//     cookie priming (that scraping is exactly what the Sakai 25 markup change
//     broke - WW-3330).
//   * Public media renders directly with no launch/session.
//   * Legacy embeds (pre-content-item markup: _ww_img + JSON-in-rel) are
//     recognized and rendered under the same rules; malformed legacy data
//     degrades to a safe, visible placeholder with a diagnostic instead of
//     throwing and breaking the surrounding page.
//   * The Sakai 25 round-trip prelaunch redirect is handled by the browser
//     following the launch iframe's own redirect; rendering never waits on a
//     fixed timer. We additionally listen for org.sakailms.lti.prelaunch purely
//     for diagnostics.
**********************************************************************/
(($) => {
	// Shared runtime (version, config, diagnostics). Fall back to no-ops so the
	// renderer still works if the runtime failed to load (and says so).
	const W = window.WARPWIRE || {
		cfg: () => ({}),
		log: () => {},
		warn: (...a) => {
			try {
				console.warn("[warpwire]", ...a);
			} catch (_e) {}
		},
	};
	if (!window.WARPWIRE) {
		W.warn("shared runtime (warpwire.js) not loaded; rendering with defaults");
	}

	// One canonical iframe permission string (was duplicated in 3+ places).
	const ALLOW = "autoplay *; encrypted-media *; fullscreen *;";

	// Append a query argument to a URL without corrupting it. Fixes the legacy
	// double-"?" bug (it appended "?" to a url that already had a query string)
	// and preserves values containing reserved characters such as "=" via proper
	// encoding. (spec: correct URL/parameter handling)
	const addUrlArgument = (url, key, value) => {
		try {
			const u = new URL(url, window.location.href);
			u.searchParams.set(key, value);
			return u.toString();
		} catch (_e) {
			// Relative / non-absolute URL: append manually, picking the correct
			// separator based on whether a query string already exists.
			const sep = url.indexOf("?") === -1 ? "?" : "&";
			return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
		}
	};

	// For a SAME-ORIGIN (Sakai) launch URL, align its protocol to the current
	// page so an http dev deployment isn't forced to https (and vice-versa) - the
	// content-item launch endpoint lives on the Sakai origin. External URLs
	// (Warpwire media) are left untouched; those are handled as https by callers.
	const alignOriginProtocol = (url) => {
		try {
			const u = new URL(url, window.location.href);
			if (u.host === window.location.host) {
				u.protocol = window.location.protocol;
				return u.toString();
			}
			return url;
		} catch (_e) {
			return url;
		}
	};

	// Build a playback iframe. width/height are set via .attr() (not the jQuery
	// $("<iframe>", {...}) attribute map, which would invoke the .width()/.height()
	// *methods* and set CSS dimensions instead of the HTML attributes). The src is
	// used as-is (callers pre-normalize protocol as appropriate).
	const buildIframe = (src, width, height, title) => {
		const $iframe = $("<iframe>");
		$iframe.attr({
			src: String(src),
			width,
			height,
			allowfullscreen: "",
			scrolling: "0",
			frameborder: "0",
			title: title?.length ? title : "Warpwire Media",
			allow: ALLOW,
		});
		return $iframe;
	};

	// Emit an actionable diagnostic if a playback launch appears not to complete.
	// A restricted launch that fails does so on Warpwire's side (a cross-origin
	// page we cannot read - e.g. "OAuth validation has failed" for a bad LTI
	// key/secret), so we cannot inspect the exact error from here. Instead we set
	// a diagnostic watchdog: the launch iframe is expected to navigate to the
	// Warpwire origin; if after a grace period it is still readable as
	// same-origin (i.e. it never left Sakai), the launch did not even start -
	// and either way we surface the cause categories so an operator sees a
	// reason instead of a bare lock. Diagnostic only - never gates playback.
	let playbackGuidanceLogged = false;
	const diagnosePlayback = ($iframe, src) => {
		const el = $iframe[0];
		if (!el) return;
		// A restricted-launch failure is opaque cross-origin (Warpwire renders the
		// error, e.g. "OAuth validation has failed", on its own origin). So when
		// diagnostics are on we proactively log the cause categories once, so an
		// operator debugging a lock has a reason to check instead of a bare lock.
		if (!playbackGuidanceLogged) {
			playbackGuidanceLogged = true;
			W.log(
				"Warpwire playback launches render here. If a restricted item shows a lock/error, the cause is usually: " +
					'(1) LTI 1.1 key/secret mismatch ("OAuth validation has failed"); ' +
					"(2) blocked cross-site cookies (needs SameSite=None; Secure over HTTPS); " +
					"(3) the viewer is not entitled to this media in Warpwire.",
			);
		}
		let settled = false;
		el.addEventListener("load", () => {
			settled = true;
			let stuckSameOrigin = false;
			try {
				// If we can still read the frame's href after load, it never left
				// the Sakai origin -> the launch failed to start.
				void el.contentWindow.location.href;
				stuckSameOrigin = true;
			} catch (_e) {
				// cross-origin: the launch navigated to Warpwire (expected path).
			}
			if (stuckSameOrigin) {
				W.warn(
					`Warpwire playback launch did not start for ${src}. Verify the tool is a valid LTI 1.1 content-item tool and that /access/lti is reachable.`,
				);
			}
		});
		// Watchdog: if the frame never even fires load, say so with the causes.
		setTimeout(() => {
			if (settled) return;
			W.warn(
				`Warpwire playback launch has not completed for ${src}. If the media shows a lock/error, the cause is usually one of: ` +
					`(1) LTI 1.1 key/secret mismatch ("OAuth validation has failed"); ` +
					`(2) blocked cross-site cookies (needs SameSite=None; Secure over HTTPS); ` +
					`(3) the viewer is not entitled to this media in Warpwire.`,
			);
		}, 12000);
	};

	// Read a pixel dimension (width/height) from an inline style string, so a
	// content-item span that lost its <img> can still be sized from its own style.
	const styleDim = ($span, prop) => {
		const m = new RegExp(`${prop}\\s*:\\s*(\\d+)`).exec(
			$span.attr("style") || "",
		);
		return m ? parseInt(m[1], 10) : 0;
	};

	// A content-item embed's rel is a launch URL (absolute or root-relative, e.g.
	// /access/lti/.../content:N); a legacy embed's rel is a JSON object string.
	// Deciding by the rel SHAPE - not by the presence/class of the <img> child -
	// makes rendering resilient to a content-item span whose <img> (or its class)
	// was stripped by the editor's content filter on a re-edit/re-save.
	const isContentItemLaunch = (rel) => {
		if (!rel) return false;
		const t = rel.trim();
		if (!t.length || t.charAt(0) === "{") return false; // legacy JSON
		return (
			/^https?:\/\//i.test(t) ||
			t.indexOf("/access/lti/") !== -1 ||
			t.charAt(0) === "/"
		);
	};

	// Render a NEW-format content-item embed:
	//   <span class="_ww_iframe_embed" rel="<launch-url>">
	//     <img class="lti-content-item-iframe-launch" .../></span>
	// The launch URL self-authenticates (restricted) or serves public media, so
	// the iframe src is simply that URL - no priming, no scraping. The <img> is
	// optional: if it is missing (e.g. filtered out on a re-save) we still render
	// the launch, sizing from the img, then the span's style, then defaults.
	const renderContentItemEmbed = ($span) => {
		const launchUrl = $span.attr("rel");
		if (!launchUrl || !launchUrl.trim().length) {
			W.warn(
				"content-item embed missing launch URL in rel; skipping",
				$span[0],
			);
			return;
		}
		const $img = $span.children("img").first();
		const src = alignOriginProtocol(launchUrl);
		const $iframe = buildIframe(
			src,
			$img.attr("width") || styleDim($span, "width") || 640,
			$img.attr("height") || styleDim($span, "height") || 360,
			$img.attr("alt"),
		);
		if ($img.length) {
			$img.replaceWith($iframe);
		} else {
			// No img to swap - render into the (empty) span, replacing any content.
			$span.empty().append($iframe);
		}
		W.log("rendered content-item launch embed", src);
		diagnosePlayback($iframe, src);
	};

	// Render a LEGACY embed:
	//   <span class="_ww_iframe_embed" rel='{"_ww_src":"…","_ww_width":…}'>
	//     <img class="_ww_img" .../></span>
	// The direct media src plays public media; restricted legacy media that has
	// not been migrated still requires the viewer's Warpwire session. The batch
	// migration (openspec §6) upgrades these to launch-carrying embeds for
	// reliable restricted playback.
	const renderLegacyEmbed = ($span) => {
		const rel = $span.attr("rel");
		if (!rel) {
			W.warn("legacy embed missing rel data; leaving placeholder", $span[0]);
			return;
		}

		let parsed;
		try {
			parsed = JSON.parse(rel);
		} catch (_e) {
			// Malformed stored data: degrade to a safe, visible state + diagnostic
			// rather than throwing and breaking the surrounding page. (spec 5.2)
			W.warn("legacy embed has malformed rel JSON; degrading", rel);
			$span.append(
				$("<span>", {
					text: "[Warpwire media unavailable]",
					style:
						"display:inline-block;padding:4px 8px;color:#666;font-style:italic;",
				}),
			);
			return;
		}

		// Normalize the _ww_ prefixed keys.
		const data = {};
		$.each(parsed, (name, value) => {
			data[String(name).replace("_ww_", "")] = value;
		});
		if (!data.src) {
			W.warn("legacy embed missing src; leaving placeholder", parsed);
			return;
		}

		// Always over TLS; tag the request with the Sakai context origin.
		const src = addUrlArgument(
			String(data.src).replace("http://", "https://"),
			"co",
			"sakai",
		);

		const $img = $span.children("img._ww_img").first();
		let width = 640;
		let height = 360;
		let title = data.alt || data.src;
		if ($img.length) {
			if (parseInt($img.attr("width"), 10) > 0)
				width = parseInt($img.attr("width"), 10);
			if (parseInt($img.attr("height"), 10) > 0)
				height = parseInt($img.attr("height"), 10);
			if ($img.attr("alt")) title = $img.attr("alt");
		} else {
			if (parseInt(data.width, 10) > 0) width = parseInt(data.width, 10);
			if (parseInt(data.height, 10) > 0) height = parseInt(data.height, 10);
		}

		const $iframe = buildIframe(src, width, height, title);
		if ($img.length) {
			$img.replaceWith($iframe);
		} else {
			$span.append($iframe);
		}
		W.log("rendered legacy embed", src);
	};

	// Render every Warpwire embed found in a document. Each embed is rendered
	// independently and its failure is isolated so one bad embed can't break the
	// page or the other embeds.
	const renderEmbeds = (doc) => {
		$(doc)
			.find("span._ww_iframe_embed")
			.each((_i, span) => {
				const $span = $(span);
				try {
					// Link-style content-item launches are already anchors; leave them.
					if ($span.children("a.lti-content-item-launch").length) {
						return;
					}
					// Decide by the rel SHAPE (launch URL vs. legacy JSON), not by the
					// <img> child, so a content-item span whose img/class was stripped
					// still renders as a launch instead of degrading to a placeholder.
					if (isContentItemLaunch($span.attr("rel"))) {
						renderContentItemEmbed($span);
					} else {
						renderLegacyEmbed($span);
					}
				} catch (e) {
					W.warn("unexpected error rendering embed; skipping", e);
				}
			});
	};

	// Recurse into same-origin nested iframes (e.g. an HTML resource rendered in
	// a frame) to find embeds there too. Uses the jQuery-3-safe .on('load') (the
	// old .load() alias was removed in jQuery 3.0) and returns quietly on
	// cross-origin frames, which we can't and shouldn't reach into.
	const scanFrames = (doc) => {
		renderEmbeds(doc);
		$(doc)
			.find("iframe")
			.each((_i, frame) => {
				$(frame).on("load", (ev) => {
					const f = ev.currentTarget;
					let innerDoc = null;
					try {
						innerDoc = f.contentDocument || f.contentWindow.document;
					} catch (_e) {
						return; // cross-origin
					}
					if (innerDoc) scanFrames(innerDoc);
				});
			});
	};

	// Diagnostic-only listener for the Sakai 25 round-trip prelaunch redirect.
	// Rendering never waits on this; it exists so the flow is observable and a
	// stuck launch leaves a trace instead of a bare lock. (spec 4.4 / 4.5)
	window.addEventListener("message", (e) => {
		let data = e.data;
		if (typeof data === "string") {
			try {
				data = JSON.parse(data);
			} catch (_e) {
				return;
			}
		}
		if (data && data.subject === "org.sakailms.lti.prelaunch") {
			W.log("observed LTI prelaunch redirect from", e.origin);
		}
	});

	$(document).ready(function () {
		const cfg = W.cfg();
		if (!cfg.instanceDomain) {
			// Not fatal for public content-item launches, but restricted playback
			// and legacy rendering need the instance domain configured.
			W.warn(
				"Warpwire instance domain is not configured; restricted playback may not authenticate. See plugin config (WARPWIRE_DEPLOY / sakai.properties).",
			);
		}
		scanFrames(document);
	});
})(
	// Prefer Sakai's portal-bundled jQuery ($PBJQ), then global jQuery/$. Guarded
	// with typeof so a missing global degrades to a clear diagnostic instead of a
	// bare ReferenceError at load.
	(() => {
		if (typeof $PBJQ !== "undefined" && $PBJQ) return $PBJQ;
		if (typeof jQuery !== "undefined" && jQuery) return jQuery;
		if (typeof $ !== "undefined" && $) return $;
		try {
			console.warn("[warpwire] jQuery not available; portal renderer disabled");
		} catch (_e) {}
		// Minimal no-op shim so the top-level $(document).ready(...) and the
		// jQuery calls in this file don't throw when jQuery is genuinely absent.
		const noop = () => stub;
		const stub = () => stub;
		Object.assign(stub, {
			ready: noop,
			find: noop,
			each: noop,
			on: noop,
			attr: noop,
			children: noop,
			first: noop,
			append: noop,
			replaceWith: noop,
			length: 0,
		});
		return stub;
	})(),
);
