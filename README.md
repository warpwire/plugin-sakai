# Supported Sakai Versions

This plugin is supported on Sakai 12. For earlier versions, please see our other projects, which support Sakai 10 and Sakai 11. All
future versions of Sakai will be supported by this GitHub project.

# Installation Instructions

1. Extract contents of `plugin/` folder into the root folder of the Sakai installation location. This will put the plugin files in the appropriate locations.

1. Modify `<sakai-installation-location>/webapps/library/editor/ckextraplugins/warpwirecontentitem/plugin.js` to change the variable `studentContributionUri` to contain the domain of your instance.

1. Locate the `<sakai-installation-location>/webapps/sakai-portal-render-engine-impl/vm/<skin>/includeStandardHead.vm` file in your Sakai instance,
where <skin> is the current skin in use for Sakai. In the default Sakai installation, this is the 'morpheus' skin. Within the site.vm file,
locate the following section:
    ```javascript
    #if ($loggedIn)
        <script src="$!{portalCDNPath}/portal/scripts/sessionstoragemanager.js$!{portalCDNQuery}"></script>
    #end ## END of IF ($loggedIn)
    ```
    Add add the following line immediately before it:
    ```javascript
    <script type="text/javascript" language="JavaScript" src="/portal/scripts/warpwirecontentitem.js"></script>
    ```

1. In `<sakai-installation-location>/webapps/library/editor/ckeditor.launch.js` before the line that says
    ```javascript
    CKEDITOR.plugins.addExternal('contentitem',basePath+'contentitem/', 'plugin.js');
    ```
    add this line:
    ```javascript
    CKEDITOR.plugins.addExternal('warpwirecontentitem',basePath+'warpwirecontentitem/', 'plugin.js');
    ```

1. In the same file, find the `toolbar_Full` variable and add `'WarpwireContentItem'` in the list of resource plugins. The section should look like this:
    ```javascript
    toolbar_Full:
    [
    		['About'],
    		['Source','-','Templates'],
    		// Uncomment the next line and comment the following to enable the default spell checker.
    		// Note that it uses spellchecker.net, displays ads and sends content to remote servers without additional setup.
    		//['Cut','Copy','Paste','PasteText','PasteFromWord','-','Print', 'SpellChecker', 'Scayt'],
    		['Cut','Copy','Paste','PasteText','PasteFromWord','-','Print', 'SakaiPreview'],
    		['Undo','Redo','-','Find','Replace','-','SelectAll','RemoveFormat'],
    		['NumberedList','BulletedList','-','Outdent','Indent','Blockquote','CreateDiv'],
    		'/',
    		['Bold','Italic','Underline','Strike','-','Subscript','Superscript'],
    																				['atd-ckeditor'],
    		['JustifyLeft','JustifyCenter','JustifyRight','JustifyBlock'],
    		['BidiLtr', 'BidiRtl' ],
    		['Link','Unlink','Anchor'],
    		(sakai.editor.enableResourceSearch
    				? ( sakai.editor.contentItemUrl
    						? ['WarpwireContentItem', 'ContentItem', 'AudioRecorder','ResourceSearch', 'Image','Movie','Table','HorizontalRule','Smiley','SpecialChar']
    						: ['AudioRecorder','ResourceSearch', 'Image','Movie','Table','HorizontalRule','Smiley','SpecialChar']
    					)
    				: ( sakai.editor.contentItemUrl
    						? ['WarpwireContentItem', 'ContentItem', 'AudioRecorder', 'Image','Movie','Table','HorizontalRule','Smiley','SpecialChar']
    						: ['AudioRecorder', 'Image','Movie','Table','HorizontalRule','Smiley','SpecialChar']
    					)
    		),
    		['Styles','Format','Font','FontSize'],
    		['TextColor','BGColor'],
    		['Maximize', 'ShowBlocks']
    		,['A11ychecker']
    ],
    ```

1. In the same file, add the plugin to the `extraPlugins` variable by changing this line:
    ```javascript
    ckconfig.extraPlugins+="sakaipreview,image2,audiorecorder,contentitem,movieplayer,wordcount,notification,autosave";
    ```
    to this line:
    ```javascript
    ckconfig.extraPlugins+="warpwirecontentitem,sakaipreview,image2,audiorecorder,contentitem,movieplayer,wordcount,notification,autosave";
    ```

1. Restart Sakai.
