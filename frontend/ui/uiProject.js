class UIProject extends UIElement
{
    constructor()
    {
        super('div');
        this.addClass(['ui','container-bg','project']); 
    }

    create()
    {
        this.container = new UIContainerFoldable({'label': 'ParamExplorer'});

            this.containerSelectAddSession = UI.div().addClass('container-session-select-add');
            this.containerSelectAddSession.bFlex = true;

                this.selectSession = UI.select({'label' : 'Session'});
                this.selectSession.addClass(['mb']).change( async val=>
                {
                    // Session id
                    __UI_PARAM_EXPLORER__.session_id    = val;

                    // Param explorer / agent 
                    await paramExplorer.reset().update();

                    // UI
                    await uiViewGallery.unselectAllImages();
                    uiViewExploreManual.reset();
                    uiViewExploreBatch.reset();
                    await uiViewGallery.load();

                    // Write to local storage
                    setSessionId(PREFIX_SESSION_ID, __UI_PARAM_EXPLORER__.session_id);
                });

                this.btnAddSession = UI.button({'label' : '+'}).click( _=> 
                {
                    this.btnAddSession.disable();
                    this.selectSession.disable();

                    let id = generateSessionId();
                    this.teSessionName.val('');
                    this.teSessionId.val(id);

                    this.containerSessionEdit.show();
                });

            this.containerSelectAddSession.child([this.selectSession, this.btnAddSession]);

            this.containerSessionEdit = UI.div().addClass('container-for-select'); // TODO : not a cool name for class (should be more generic)

                this.teSessionId    = new UITextInput({'label':'Id'});
                this.teSessionId.disable();
                this.teSessionName  = new UITextInput({'label':'Name'});
                this.teSessionName.hide();

                this.btnAddSessionValidation = UI.div().addClass('container-session-validate-add');
                this.btnAddSessionValidation.bFlex = true;

                    let _emptyContainerSessionEdit = ()=>{
                        this.containerSessionEdit.hide();
                        this.teSessionName.val('');
                        this.teSessionId.val('');
                        this.btnAddSession.enable();
                        this.selectSession.enable();
                    }

                    this.btnAddSessionCancel    = UI.button({'label' : 'Cancel'}).click(_=> { _emptyContainerSessionEdit() } );
                    this.btnAddSessionOK        = UI.button({'label' : 'Ok'}).click(_=>
                    {
                        addSessionIdList( __SESSION_UNIQUE_PREFIX__, this.teSessionId.val() );
                        _emptyContainerSessionEdit();
                        this.updateLayout();
                    });

                this.btnAddSessionValidation.child([this.btnAddSessionCancel, this.btnAddSessionOK]);


            this.containerSessionEdit.child([this.teSessionId, this.teSessionName, this.btnAddSessionValidation]);
            this.containerSessionEdit.hide();

            this.container.child_([this.containerSelectAddSession, this.containerSessionEdit]);

        this.child([this.container]);
        this.updateLayout();
    }

    updateLayout()
    {
        let mapSessions = new Map();
        let sessionsIds = getSessionsIdsList(__SESSION_UNIQUE_PREFIX__);
        sessionsIds.forEach( id=>mapSessions.set(id,id) ); 

        this.selectSession.clear().add(mapSessions, {'fromKeys':true});
        this.selectSession.val(__UI_PARAM_EXPLORER__.session_id);
    }
}