/*
 *
 * (c) Copyright Ascensio System SIA 2010-2019
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA at 20A-12 Ernesta Birznieka-Upisha
 * street, Riga, Latvia, EU, LV-1050.
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * Pursuant to Section 7(b) of the License you must retain the original Product
 * logo when distributing the program. Pursuant to Section 7(e) we decline to
 * grant you any rights under trademark law for use of our trademarks.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
*/
DE.ApplicationController = new(function(){
    var me,
        api,
        config = {},
        docConfig = {},
        permissions = {},
        maxPages = 0,
        created = false,
        appOptions = {},
        _submitFail, $submitedTooltip,
        bodyWidth = 0;

    var LoadingDocument = -256;

    // Check browser
    // -------------------------

    if (typeof isBrowserSupported !== 'undefined' && !isBrowserSupported()){
        //Common.Gateway.reportError(undefined, this.unsupportedBrowserErrorText);
        console.error(this.unsupportedBrowserErrorText);
        return;
    }

    common.localStorage.setId('text');
    common.localStorage.setKeysFilter('de-,asc.text');
    common.localStorage.sync();

    // Handlers
    // -------------------------

    function loadConfig(data) {
        config = $.extend(config, data.config);
    }

    function loadDocument(data) {
        docConfig = data.doc;

        if (docConfig) {
            permissions = $.extend(permissions, docConfig.permissions);

            var _permissions = $.extend({}, docConfig.permissions),
                docInfo = new Asc.asc_CDocInfo(),
                _user = new Asc.asc_CUserInfo();

            var canRenameAnonymous = !((typeof (config.customization) == 'object') && (typeof (config.customization.anonymous) == 'object') && (config.customization.anonymous.request===false)),
                guestName = (typeof (config.customization) == 'object') && (typeof (config.customization.anonymous) == 'object') &&
                            (typeof (config.customization.anonymous.label) == 'string') && config.customization.anonymous.label.trim()!=='' ?
                            common.utils.htmlEncode(config.customization.anonymous.label) : me.textGuest,
                value = canRenameAnonymous ? common.localStorage.getItem("guest-username") : null;//,
                user = common.utils.fillUserInfo(config.user, config.lang, value ? (value + ' (' + guestName + ')' ) : me.textAnonymous,
                                                 common.localStorage.getItem("guest-id") || ('uid-' + Date.now()));
            user.anonymous && common.localStorage.setItem("guest-id", user.id);

            _user.put_Id(user.id);
            _user.put_FullName(user.fullname);
            _user.put_IsAnonymousUser(user.anonymous);

            docInfo.put_Id(docConfig.key);
            docInfo.put_Url(docConfig.url);
            docInfo.put_Title(docConfig.title);
            docInfo.put_Format(docConfig.fileType);
            docInfo.put_VKey(docConfig.vkey);
            docInfo.put_UserInfo(_user);
            docInfo.put_Token(docConfig.token);
            docInfo.put_Permissions(_permissions);
            docInfo.put_EncryptedInfo(config.encryptionKeys);

            var enable = !config.customization || (config.customization.macros!==false);
            docInfo.asc_putIsEnabledMacroses(!!enable);
            enable = !config.customization || (config.customization.plugins!==false);
            docInfo.asc_putIsEnabledPlugins(!!enable);


            var type = /^(?:(pdf|djvu|xps))$/.exec(docConfig.fileType);
            if (type && typeof type[1] === 'string') {
                permissions.edit = permissions.review = false;
            }

            if (api) {
                api.asc_registerCallback('asc_onGetEditorPermissions', onEditorPermissions);
                api.asc_registerCallback('asc_onRunAutostartMacroses', onRunAutostartMacroses);
                api.asc_setDocInfo(docInfo);
                api.asc_getEditorPermissions(config.licenseUrl, config.customerId);
                api.asc_enableKeyEvents(true);
            }
        }
    }

   function onLongActionBegin(type, id) {

        if (type == Asc.c_oAscAsyncActionType['BlockInteraction']) {
            if (!me.loadMask)
                me.loadMask = new common.view.LoadMask();
            me.loadMask.show();
        }
    }

    function onLongActionEnd(type, id){
        me.loadMask && me.loadMask.hide();
    }

    function onPrint() {
        if ( permissions.print!==false )
            api.asc_Print(new Asc.asc_CDownloadOptions(null, false));
    }
    function onPrintUrl(url) {
        common.utils.dialogPrint(url, api);
    }
    function onDownloadUrl(url, fileType) {
        Common.Gateway.downloadAs(url, fileType);
    }

    function hidePreloader() {
        $('#loading-mask').fadeOut('slow');
    }

    function onDocumentContentReady() {
        hidePreloader();
        onLongActionEnd(Asc.c_oAscAsyncActionType['BlockInteraction'], LoadingDocument);

        var zf = (config.customization && config.customization.zoom ? parseInt(config.customization.zoom) : -2);
        (zf == -1) ? api.zoomFitToPage() : ((zf == -2) ? api.zoomFitToWidth() : api.zoom(zf>0 ? zf : 100));



        api.asc_registerCallback('asc_onStartAction',           onLongActionBegin);
        api.asc_registerCallback('asc_onEndAction',             onLongActionEnd);
        api.asc_registerCallback('asc_onHyperlinkClick',        common.utils.openLink);
        api.asc_registerCallback('asc_onDownloadUrl',           onDownloadUrl);
        api.asc_registerCallback('asc_onPrint',                 onPrint);
        api.asc_registerCallback('asc_onPrintUrl',              onPrintUrl);



        Common.Gateway.on('processmouse',       onProcessMouse);
        Common.Gateway.on('downloadas',         onDownloadAs);
        Common.Gateway.on('requestclose',       onRequestClose);
        var downloadAs =  function(format){
            api.asc_DownloadAs(new Asc.asc_CDownloadOptions(format));
        };

        // TODO: add asc_hasRequiredFields to sdk
        Common.Gateway.documentReady();
    }

    function onEditorPermissions(params) {

        var licType = params.asc_getLicenseType();
        appOptions.canLicense     = (licType === Asc.c_oLicenseResult.Success || licType === Asc.c_oLicenseResult.SuccessLimit);
        //appOptions.canFillForms   = appOptions.canLicense && (permissions.fillForms===true) && (config.mode !== 'view');
        appOptions.canSubmitForms = appOptions.canLicense && (typeof (config.customization) == 'object') && !!config.customization.submitForm;

        //api.asc_setViewMode(!appOptions.canFillForms);
        //api.asc_setViewMode(false);
        /*if (appOptions.canFillForms) {*/

            //api.asc_setRestriction(Asc.c_oAscRestrictionType.OnlyForms);
            //api.asc_SetFastCollaborative(true);
            api.asc_setAutoSaveGap(1);
        /*}*/
        onLongActionBegin(Asc.c_oAscAsyncActionType['BlockInteraction'], LoadingDocument);

        api.asc_LoadDocument();
        api.Resize();
    }

    function onOpenDocument(progress) {
        var proc = (progress.asc_getCurrentFont() + progress.asc_getCurrentImage())/(progress.asc_getFontsCount() + progress.asc_getImagesCount());
        me.loadMask && me.loadMask.setTitle(me.textLoadingDocument + ': ' + common.utils.fixedDigits(Math.min(Math.round(proc*100), 100), 3, "  ") + '%');
    }

    function onError(id, level, errData) {
        if (id == Asc.c_oAscError.ID.LoadingScriptError) {
            $('#id-critical-error-title').text(me.criticalErrorTitle);
            $('#id-critical-error-message').text(me.scriptLoadError);
            $('#id-critical-error-close').text(me.txtClose).off().on('click', function(){
                window.location.reload();
            });
            $('#id-critical-error-dialog').css('z-index', 20002).modal('show');
            return;
        }

        hidePreloader();
        onLongActionEnd(Asc.c_oAscAsyncActionType['BlockInteraction'], LoadingDocument);

        var message;

        switch (id)
        {
            case Asc.c_oAscError.ID.Unknown:
                message = me.unknownErrorText;
                break;

            case Asc.c_oAscError.ID.ConvertationTimeout:
                message = me.convertationTimeoutText;
                break;

            case Asc.c_oAscError.ID.ConvertationError:
                message = me.convertationErrorText;
                break;

            case Asc.c_oAscError.ID.DownloadError:
                message = me.downloadErrorText;
                break;

            case Asc.c_oAscError.ID.ConvertationPassword:
                message = me.errorFilePassProtect;
                break;

            case Asc.c_oAscError.ID.UserDrop:
                message = me.errorUserDrop;
                break;

            case Asc.c_oAscError.ID.ConvertationOpenLimitError:
                message = me.errorFileSizeExceed;
                break;

            case Asc.c_oAscError.ID.UpdateVersion:
                message = me.errorUpdateVersionOnDisconnect;
                break;

            case Asc.c_oAscError.ID.AccessDeny:
                message = me.errorAccessDeny;
                break;

            case Asc.c_oAscError.ID.Submit:
                message = me.errorSubmit;
                _submitFail = true;
                $submitedTooltip && $submitedTooltip.hide();
                break;

            case Asc.c_oAscError.ID.EditingError:
                message = me.errorEditingDownloadas;
                break;

            case Asc.c_oAscError.ID.ForceSaveButton:
            case Asc.c_oAscError.ID.ForceSaveTimeout:
                message = me.errorForceSave;
                break;

            case Asc.c_oAscError.ID.LoadingFontError:
                message = me.errorLoadingFont;
                break;

            default:
                message = me.errorDefaultMessage.replace('%1', id);
                break;
        }

        if (level == Asc.c_oAscError.Level.Critical) {

            // report only critical errors
            //Common.Gateway.reportError(id, message);
            console.error(id,message);
            $('#id-critical-error-title').text(me.criticalErrorTitle);
            $('#id-critical-error-message').html(message);
            $('#id-critical-error-close').text(me.txtClose).off().on('click', function(){
                window.location.reload();
            });
        }
        else {
            //Common.Gateway.reportWarning(id, message);
            console.warn(id, message);

            $('#id-critical-error-title').text(me.notcriticalErrorTitle);
            $('#id-critical-error-message').html(message);
            $('#id-critical-error-close').text(me.txtClose).off().on('click', function(){
                $('#id-critical-error-dialog').modal('hide');
            });
        }

        $('#id-critical-error-dialog').modal('show');
    }

    function onExternalMessage(error) {
        if (error) {
            hidePreloader();
            $('#id-error-mask-title').text(me.criticalErrorTitle);
            $('#id-error-mask-text').text(error.msg);
            $('#id-error-mask').css('display', 'block');
        }
    }


    function onProcessMouse(data) {
        if (data.type == 'mouseup') {
            var e = document.getElementById('editor_sdk');
            if (e) {
                var r = e.getBoundingClientRect();
                api.OnMouseUp(
                    data.x - r.left,
                    data.y - r.top
                );
            }
        }
    }

    function onRequestClose() {
        Common.Gateway.requestClose();
    }

    function onDownloadAs() {
        if ( permissions.download === false) {
            //Common.Gateway.reportError(Asc.c_oAscError.ID.AccessDeny, me.errorAccessDeny);
            console.error(Asc.c_oAscError.ID.AccessDeny, me.errorAccessDeny);
            return;
        }
        if (api) api.asc_DownloadAs(new Asc.asc_CDownloadOptions(Asc.c_oAscFileType.DOCX, false));
    }

    function onRunAutostartMacroses() {
        if (!config.customization || (config.customization.macros!==false))
            if (api) api.asc_runAutostartMacroses();
    }

    function onBeforeUnload () {
        common.localStorage.save();
    }
        // Helpers
    // -------------------------

    function onDocumentResize() {
        api && api.Resize();
        bodyWidth = $('body').width();
    }

    function createController(){
        if (created)
            return me;

        me = this;
        created = true;

        $(window).resize(function(){
            onDocumentResize();
        });
        window.onbeforeunload = onBeforeUnload;

        var ismodalshown = false;
        $(document.body).on('show.bs.modal', '.modal',
            function(e) {
                ismodalshown = true;
                api.asc_enableKeyEvents(false);
            }
        ).on('hidden.bs.modal', '.modal',
            function(e) {
                ismodalshown = false;
                api.asc_enableKeyEvents(true);
            }
        ).on('hidden.bs.dropdown', '.dropdown',
            function(e) {
                if ( !ismodalshown )
                    api.asc_enableKeyEvents(true);
            }
        ).on('blur', 'input, textarea',
            function(e) {
                if ( !ismodalshown ) {
                    if (!/area_id/.test(e.target.id) ) {
                        api.asc_enableKeyEvents(true);
                    }
                }
            }
        );

        $('#editor_sdk').on('click', function(e) {
            if ( e.target.localName == 'canvas' ) {
                e.currentTarget.focus();
            }
        });

        window["flat_desine"] = true;
        api = new Asc.asc_docs_api({
            'id-view'  : 'editor_sdk'
        });

        if (api){
            api.asc_registerCallback('asc_onError',                 onError);
            api.asc_registerCallback('asc_onDocumentContentReady',  onDocumentContentReady);
            api.asc_registerCallback('asc_onOpenDocumentProgress',  onOpenDocument);

            // Initialize api gateway
            Common.Gateway.on('init',               loadConfig);
            Common.Gateway.on('opendocument',       loadDocument);
            Common.Gateway.on('showmessage',        onExternalMessage);
            Common.Gateway.appReady();
        }

        return me;
    }

    return {
        create                  : createController,
        errorDefaultMessage     : 'Error code: %1',
        unknownErrorText        : 'Unknown error.',
        convertationTimeoutText : 'Conversion timeout exceeded.',
        convertationErrorText   : 'Conversion failed.',
        downloadErrorText       : 'Download failed.',
        criticalErrorTitle      : 'Error',
        notcriticalErrorTitle   : 'Warning',
        scriptLoadError: 'The connection is too slow, some of the components could not be loaded. Please reload the page.',
        errorFilePassProtect: 'The file is password protected and cannot be opened.',
        errorAccessDeny: 'You are trying to perform an action you do not have rights for.<br>Please contact your Document Server administrator.',
        errorUserDrop: 'The file cannot be accessed right now.',
        unsupportedBrowserErrorText: 'Your browser is not supported.',
        textLoadingDocument: 'Loading document',
        txtClose: 'Close',
        errorFileSizeExceed: 'The file size exceeds the limitation set for your server.<br>Please contact your Document Server administrator for details.',
        errorUpdateVersionOnDisconnect: 'Internet connection has been restored, and the file version has been changed.<br>Before you can continue working, you need to download the file or copy its content to make sure nothing is lost, and then reload this page.',
        errorSubmit: 'Submit failed.',
        errorEditingDownloadas: 'An error occurred during the work with the document.<br>Use the \'Download as...\' option to save the file backup copy to your computer hard drive.',
        textGuest: 'Guest',
        textAnonymous: 'Anonymous',
        errorForceSave: "An error occurred while saving the file. Please use the 'Download as' option to save the file to your computer hard drive or try again later.",
        errorLoadingFont: 'Fonts are not loaded.<br>Please contact your Document Server administrator.'
    }
})();