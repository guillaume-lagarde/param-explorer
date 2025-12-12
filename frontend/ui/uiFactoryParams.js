const __UI_FACTORY_PARAMS_LOG__     = false;
const __UI_FACTORY_SHOW_FREEZE__    = false;

// ----------------------------------------------------
// Association param name -> controls (easier for update)
let uiMapParamControls = new Map();

// For managing groups
let uiGroupContainers = new Map();

// ----------------------------------------------------
function uiCreateControl(name, param, cbChange, opts={})
{
    let uiControl = null;
    if (param.type == 'float' || param.type == 'integer') 
    {
        uiControl = new UISliderCheckbox(name, param, opts);
    }
    else if (param.type == 'choice')
    {
        uiControl = new UISelectCheckbox(name, param, opts);
    } 

    if (uiControl)
    {
        if (isFunction(cbChange))
            uiControl.change( (name,val)=>cbChange(name,val) );

        if (__UI_FACTORY_PARAMS_LOG__)
            console.log(`uiCreateControlsFromParamsExplorer(), adding ${name}`, param);
        return uiControl;
    }

    return null;
}

// ----------------------------------------------------
function uiCreateControlsFromParamsExplorer(paramExplorer, cbChange)
{
    let uiControls = [];

    let optsParamControl = {'bShowFreeze':__UI_FACTORY_SHOW_FREEZE__};

    for (let name in paramExplorer.parameters)
    {
        let param       = paramExplorer.parameters[name];
        let uiControl   = uiCreateControl(name, param, cbChange, optsParamControl);
        if (uiControl)
        {
            let groupName   = getGroup(paramExplorer,name);

            // Not in group
            if (groupName == null)
            {
                uiControls.push(uiControl);
            }
            else 
            {
                let container = uiGroupContainers.get(groupName);
                if (!container)
                {
                    container = new UIContainerFoldable({'label':`→ ${groupName}`});
                    //container.lbl.addClass('sub');
                    uiControls.push(container);
                    uiGroupContainers.set(groupName, container)
                }
                container.child_(uiControl);
            }
        
            uiMapParamControls.set(name, uiControl);
        }
    }

    uiGroupContainers.forEach( container=>uiControls.push(container) );

    return uiControls;
}

// ----------------------------------------------------
function uiUpdateControlsFromParamsExplorer(paramExplorer)
{
    if (__UI_FACTORY_PARAMS_LOG__)
        console.group('uiUpdateControlsFromParamsExplorer()');
    uiMapParamControls.forEach( (control,paramName)=>
    {
        if (__UI_FACTORY_PARAMS_LOG__)
            console.log(`updating control for ${paramName}, val=${paramExplorer.parameters[paramName]['obj'][paramName]}`);
        control.updateLayout();
    });
    if (__UI_FACTORY_PARAMS_LOG__)
        console.groupEnd();
}

// ----------------------------------------------------
function isInGroup(paramExplorer, name)
{
    if (paramExplorer.groups && paramExplorer.groups.length > 0)
    {
        for (let groupName in paramExplorer.groups)
        {
            if (paramExplorer.groups[groupName].keys.includes(name))
                return true;
        }
    }
    return false;
}

// ----------------------------------------------------
function getGroup(paramExplorer, name)
{
    if (paramExplorer.groups && paramExplorer.groups.length > 0)
    {
        for (let i=0;i<paramExplorer.groups.length;i++)
        {
            let group = paramExplorer.groups[i];
            if (group.keys.includes(name))
                return group.name;
        }
    }
    return null;
}

