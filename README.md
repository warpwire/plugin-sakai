# Supported Sakai Versions

This plugin is supported on Sakai 12. For earlier versions, please see our other projects, which support Sakai 10 and Sakai 11. All
future versions of Sakai will be supported by this GitHub project.

# Installation Instructions

1. Extract contents of `plugin/` folder into the root folder of the Sakai installation location. This will put the plugin files in the appropriate locations.

1. Modify `<sakai-installation-location>/webapps/library/editor/ckextraplugins/warpwirecontentitem/plugin.js` to change the variable `studentContributionUri` to contain the domain of your instance.

1. Locate the `<sakai-installation-location>/webapps/sakai-portal-render-engine-impl/vm/<skin>/site.vm` file in your Sakai instance,
where `<skin>` is the current skin in use for Sakai. In the default Sakai installation, this is the 'morpheus' skin. Within the `site.vm` file,
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
1. **NOTE:** if you are **building Sakai from source**, add the `ckconfig.extraPlugins` in the javascript file to the
`sakai/library/pom.xml` configuration file. There will be a section called `<ckeditor-extra-plugins>`, simply put the value in this location and it will be compiled when Sakai is built from source.

1. Restart Sakai.

# Installing the Plugin in Sakai, so that it is available for all sites

1. Login to Sakai as the admin user. 

2. Navigate to the 'Administrative Workspace'

3. Click 'External Tools' in the left column navigation menu. 

4. Click the 'Install LTI 1.1 Tool' text link on the far right of the page. 

5. Fill out the External Tool fields as follows:
    - __Site Id (Leave blank to make tool available in all sites)__ = Leave Blank
    - __Tool Title (Above the tool)__ = Warpwire
    - __Allow tool title to be changed__ = Do not allow
    - __Choose a custom icon (leave empty to use the default icon)__ = leave empty
    - __Button Text (Text in tool menu)__ = Warpwire
    - __Allow button text to be changed__ = Do not allow
    - __Description__ = leave blank
    - __Tool Status__ = Enabled
    - __Tool Visibility__ = Visible
    - __Launch URL__ = [YOUR_DOMAIN].waprwire.com/api/ltix/
    - __Allow launch URL to be changed__ = Do not allow
    - __Launch Key__ = this will be provided by Warpwire
    - __Allow launch Key to be changed__ = Do not allow
    - __Launch Secret__ = this will be provided by Warpwire
    - __Allow launch secret to be changed__ = Do not allow
    - __Frame Height__ = leave blank
    - __Tool Order (Only valid for tools placed in all sites)__ = leave blank
    - __Allow frame height to be changed__ = Allow
    - __Configuration dialog when tool is selected__ = Bypass configuration dialog
    - __Privacy settings__ = check both boxes
    - __Services__ = check the following:
      - 'Allow External Tool to return grades,' 
      - 'Provide roster to external tool,' 
      - 'Allow External Tool to store settings data'
    - __Indicate the following types of Content Item Selection launches this tool can handle [...]__ = Select the first three boxes:
      - 'Allow the tool to be launched as a link (this is typically true for most tools),' 
      - 'Allow external tool to configure itself (the tool must support the IMS Content-Item message),' 
      - 'Allow the tool to be used from the rich text content editor to select contenet (the tool must support the IMS Content-Item message)
    - __Launch in Popup__ = Never launch in Popup
    - __Debug Launch__ = Never launch in debug mode
    - __Custom Parameters__ = leave blank
    - __SHA-256 Signature Support__ = Sign Launch with SHA-256
    - __LTI 1.3 Support__ = Tool does not support LTI 1.3
    - __lti13_settings__ = leave blank
    - __Splash Screen__ = Leave blank
6. Hit "Save"

# Uninstalling the Legacy Warpwire Plugin

1. First remove the legacy Warpwire tool from the Tools menus of all courses that will use the new Warpwire Deep Linking plugin.  Otherwise, you may end up with a reference to a non-existant course tool that cannot be easily removed.

2. Open the following file:
`<sakai-installation-location>/webapps/library/editor/ckeditor.launch.js`

    Remove the references to Warpwire in the following sections:
    - `sakai.editor.enableResourceSearch`
    - the `extraPlugins` variable
    - the `addExternal` plugin function
    - remove the `warpwireURL` variable and associated root directory

    There should be 4 references to Warpwire. Remove them all.


3. Remove the directory:
`<sakai-installation-location>/webapps/library/editor/ckextraplugins/warpwire`

4. Remove the file:
`<sakai-installation-location>/webapps/portal/scripts/warpwire.js`

5. In the file:
    `<tomcat-installation-location>/sakai/portlets/IMSBLTIPortlet.xml`

    If you have only one XML profile for the Warpwire tool, you may remove the `IMSBLTIPortlet.xml` completely.  Otherwise, remove all of the XML configurations for the Warpwire tool identified as `sakai.warpwire`

6. In the file site.vm located either in:
    `<sakai-installation-location>/webapps/sakai-portal-render-engine-impl/vm/<skin>/site.vm` or `<sakai-installation-location>/webapps/portal-render/vm/<skin>/site.vm`, where `<skin>` is the current skin in use for Sakai.

    Remove the string `<script type=“text/javascript” src=“/portal/scripts/warpwire.js”></script>`

7. Restart Sakai to remove the plugin
