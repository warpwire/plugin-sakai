# Supported Sakai Versions

This plugin is supported on Sakai 12. For earlier versions, please see our other projects, which support Sakai 10 and Sakai 11. All
future versions of Sakai will be supported by this GitHub project.

# Installation Instructions

1. Extract contents of `plugin/` folder into the root folder of the Sakai installation location. This will put the plugin files in the appropriate locations.

1. Modify `<sakai-installation-location>/webapps/library/editor/ckextraplugins/warpwirecontentitem/plugin.js` to change the variable `studentContributionUri` to contain the domain of your instance. (Note: be sure to include the https:// prefix for the domain)

1. Locate the `<sakai-installation-location>/sakai/sakai.properties` and find the following comment block:
    ``` 
        # Allows for adding additional code into the header of both the standard and pda portals,
        # for example for adding in kaltura or other javascript code
        # DEFAULT: Empty, no value
    ```
    add this line:
    
    ```
    portal.include.extrahead=<script type="text/javascript" language="JavaScript" src="/portal/scripts/warpwirecontentitem.js"></script>
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
    				? ( sakai.editor.contentItem
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
![Sakai ADministrative Workspace](https://github.com/warpwire/plugin-sakai/blob/master/sakai-config-admin-workspace.jpg)

3. Click 'External Tools' in the left column navigation menu. 
![Sakai External Tools page](https://github.com/warpwire/plugin-sakai/blob/master/sakai-config-externaltools.jpg)

4. Click the 'Install LTI 1.1 Tool' text link on the far right of the page. 

5. Fill out the External Tool fields as follows:
    - __Site Id (Leave blank to make tool available in all sites)__ = Leave Blank
    - __Tool Title (Above the tool)__ = Warpwire
    - __Allow tool title to be changed__ = Allow
    - __Choose a custom icon (leave empty to use the default icon)__ = leave empty
    - __Button Text (Text in tool menu)__ = Warpwire
    - __Allow button text to be changed__ = Do not allow
    - __Description__ = leave blank
    - __Tool Status__ = Enabled
    - __Tool Visibility__ = Visible
    - __Launch URL__ = [YOUR_DOMAIN].waprwire.com/api/ltix/ ```(Note: this has changed from previous versions, be sure to include the x and the trailing slash!)```
    - __Allow launch URL to be changed__ = Allow
    - __Launch Key__ = this will be provided by Warpwire
    - __Allow launch Key to be changed__ = Do not allow
    - __Launch Secret__ = this will be provided by Warpwire
    - __Allow launch secret to be changed__ = Do not allow
    - __Frame Height__ = leave blank
    - __Tool Order (Only valid for tools placed in all sites)__ = leave blank
    - __Allow frame height to be changed__ = Do not allow
    - __Configuration dialog when tool is selected__ = Bypass configuration dialog
    - __Privacy settings__ = check both boxes
    - __Services__ = check the following:
      - 'Allow External Tool to return grades,' 
      - 'Allow External tool to create grade colums,'
      - 'Provide roster to external tool,' 
      - 'Allow External Tool to store settings data'
    - __Tools can generally accept direct LTI Launches or a Content-Item/Deep-Link Selection launches. It is not common, but some       tools can handle both types of launch at one endpoint__ = check the following:
      - 'The tool URL can recieve an LTI launch'
      - 'The tool can recieve a Content-Item or Deep-Link launch'
    - __Indicate where these tools are placed in Sakai__ = Select the first two boxes:
      - 'Allow the tool to be one of the assignment types'
      - 'Allow the tool to be used from the rich text editor'
    - __Launch in Popup__ = Never launch in Popup
    - __Debug Launch__ = Never launch in debug mode
    - __Custom Parameters__ = leave blank
    - __Manually map Sakai roles to IMS roles. Example: maintain:Learner;access:Learner__ = leave blank
    - __LTI 1.3 Support__ = Tool does not support LTI 1.3
    - __lti13_settings__ = leave blank
    - __Splash Screen (If this is non-blank it is shown before the tool is launched)__ = leave blank
    - __If you select LTI 1.3 support while inserting a tool, after the tool is saved, you will be presented the Sakai configuration information to copy back to the tool. You can view this information in the tool view screen if you edit the tool information__ = 'Tool does not support LTI 1.3'
    - __LTI 1.3 Platform Issuer (provide to tool)__ = Import LTI 1.3 Configuration (Sakai-format)
    - __LTI 1.3 Client ID (provide to the tool)__= leave blank
    - __LTI 1.3 Tool Keyset URL (provided by the tool)__= leave blank
    - __LTI 1.3 Tool OpenID Connect/Initialization Endpoint (provided by the tool)__ = leave blank
    - __LTI 1.3 Tool Redirect Endpoint(s) (comma seperated and provided by the tool)__ = leave blank
    - __LTI 1.3 Platform Public Key (provided to the tool through our keyset)__ = leave blank
    - __LTI 1.3 Tool Public Key (for tools that don't support keyset)__ = leave blank
    - __LTI 1.3 Tool Private Key (for tools that don't support keyset)__ = leave blank
    - __Type of LTI 1.1 Launch to use__ = Inherit System-Wide Default
6. Hit "Save"

![sakai-config-tool-settings-1](https://user-images.githubusercontent.com/22532806/120385944-05cd0e00-c2f6-11eb-8cf0-e645926d324b.jpg)
![sakai-config-tool-settings-2](https://user-images.githubusercontent.com/22532806/120385954-06fe3b00-c2f6-11eb-8e66-02c6f289ed9e.jpg)
![sakai-config-tool-settings-3](https://user-images.githubusercontent.com/22532806/120385959-08c7fe80-c2f6-11eb-9ad9-f1bca3c84861.jpg)
![sakai-config-tool-settings-4](https://user-images.githubusercontent.com/22532806/120385966-09f92b80-c2f6-11eb-92fc-59921c66e381.jpg)


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
