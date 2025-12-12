// ----------------------------------------------------
var __SESSION_UNIQUE_PREFIX__ = "";
var __SESSION_LOG__ = false;

// ----------------------------------------------------
function generateSessionId() 
{
  return 'paramexplorer-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

// ----------------------------------------------------
function formatSessionPrefix(unique_prefix)
{
  return unique_prefix?`${unique_prefix}_`:``;
}

// ----------------------------------------------------
function getSessionId(unique_prefix)
{
  __SESSION_UNIQUE_PREFIX__ = unique_prefix;

  let id = localStorage.getItem(`${formatSessionPrefix(unique_prefix)}paramExplorerSessionId`);
  if (!id) 
  {
    id = generateSessionId();
    if (__SESSION_LOG__)
        console.log(`cannot find id, generated a new one : ${id}`);
    setSessionId(unique_prefix, id);
    addSessionIdList(unique_prefix,id);
  }
  // FIXME : case paramExplorerSessionId already there but not list in local storage
  else 
  {
    addSessionIdList(unique_prefix,id);
  }
  return id;
}

// ----------------------------------------------------
function setSessionId(unique_prefix, id)
{
    if (__SESSION_LOG__)
        console.log(`setSessionId(${unique_prefix},${id})`);
    localStorage.setItem(`${formatSessionPrefix(unique_prefix)}paramExplorerSessionId`, id);
}


// ----------------------------------------------------
function getSessionsIdsList(unique_prefix)
{
  return JSON.parse( localStorage.getItem(`${formatSessionPrefix(unique_prefix)}paramExplorerSessions`) ) ?? [];
}

// ----------------------------------------------------
function setSessionsIdsList(unique_prefix, sessionsIds=[])
{
    if (__SESSION_LOG__)
        console.log(`setSessionsIdsList(${unique_prefix},${sessionsIds})`);
  localStorage.setItem(`${formatSessionPrefix(unique_prefix)}paramExplorerSessions`, JSON.stringify(sessionsIds));
}

// ----------------------------------------------------
function addSessionIdList(unique_prefix, id)
{
    if (__SESSION_LOG__)
    console.log(`addSessionIdList(${unique_prefix},${id})`);
  let ids = getSessionsIdsList(unique_prefix);
  if (ids.includes(id) == false)
  {
    ids.push(id);
  }
  setSessionsIdsList(unique_prefix,ids);
}