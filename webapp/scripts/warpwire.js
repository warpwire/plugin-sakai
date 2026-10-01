/**********************************************************************
//
// Warpwire Sakai Plugin - shared runtime
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
// This file is the SINGLE SOURCE OF TRUTH for:
//   * the plugin version string (WARPWIRE.version)
//   * the plugin's runtime configuration accessor (WARPWIRE.cfg)
//   * the diagnostic switch shared by the editor plugin and portal script
//     (WARPWIRE.log / WARPWIRE.warn)
//
// It is loaded once per portal page (via portal.include.extrahead) BEFORE the
// portal script and is also present in the window that hosts the CKEditor
// plugin, so both consumers share exactly one version + config source instead
// of hand-duplicating them across files (see design D5).
//
// Per-deployment values (Warpwire instance domain, student-contribution
// destination, cookie policy, debug flag) are injected by the packaged deploy
// as window.WARPWIRE_DEPLOY and merged over the defaults below; they are NOT
// hand-edited into source. In this dev env, scripts/gen-config.sh generates the
// WARPWIRE_DEPLOY shim from .env.
**********************************************************************/
(function (w) {
	var NS = (w.WARPWIRE = w.WARPWIRE || {});

	// The one place the plugin version is defined. Everything that reports or
	// transmits a version (e.g. the launch externalContext) reads NS.version.
	NS.version = "3.1.0";

	var DEFAULTS = {
		// Warpwire instance base URL, no trailing slash, e.g. https://x.warpwire.net
		instanceDomain: "",
		// Student-contribution destination base; falls back to instanceDomain.
		contributionUri: "",
		// Text that identifies the Warpwire LTI tool in Sakai's content-item
		// picker (matched case-insensitively against the tool's title and
		// description). Override when the tool is renamed or localized.
		toolTitle: "warpwire",
		// Site roles (Sakai role ids, case-insensitive) that may add Warpwire
		// media from the editor.
		// Everyone else gets the student-contribution flow. Defaults to the
		// maintain roles of Sakai's stock project and course site templates.
		maintainerRoles: ["maintain", "Instructor"],
		// Documented cookie policy required for cross-site iframe playback.
		cookieSameSite: "none",
		// Diagnostic switch. Also forced on by a ?wwdebug=1 query parameter.
		debug: false,
	};

	// Merge window.WARPWIRE_DEPLOY (per-install overrides) over DEFAULTS once.
	NS.cfg = function () {
		if (NS._cfg) return NS._cfg;
		var d =
			w.WARPWIRE_DEPLOY && typeof w.WARPWIRE_DEPLOY === "object"
				? w.WARPWIRE_DEPLOY
				: {};
		var c = {};
		for (var k in DEFAULTS) {
			c[k] = Object.prototype.hasOwnProperty.call(d, k) ? d[k] : DEFAULTS[k];
		}
		if (c.instanceDomain) {
			c.instanceDomain = String(c.instanceDomain).replace(/\/+$/, "");
		}
		c.contributionUri = String(
			c.contributionUri || c.instanceDomain || "",
		).replace(/\/+$/, "");
		c.version = NS.version;
		try {
			if (/[?&]wwdebug=1(&|$)/.test(w.location.search)) c.debug = true;
		} catch (_e) {}
		NS._cfg = c;
		return c;
	};

	// Verbose diagnostic - silent unless debug is on. Use for tracing the flow.
	NS.log = function () {
		try {
			if (!NS.cfg().debug) return;
			var a = Array.prototype.slice.call(arguments);
			a.unshift("[warpwire]");
			if (w.console && w.console.log) w.console.log.apply(w.console, a);
		} catch (_e) {}
	};

	// Actionable warning - ALWAYS emitted, even with debug off, so load-bearing
	// failures (missing tool, failed launch, malformed embed) leave a trace
	// instead of failing silently.
	NS.warn = function () {
		try {
			var a = Array.prototype.slice.call(arguments);
			a.unshift("[warpwire]");
			if (w.console && w.console.warn) w.console.warn.apply(w.console, a);
		} catch (_e) {}
	};
})(window);
