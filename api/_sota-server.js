'use strict';
// The server's privileged reads and writes (sere jobs, the sere and upload buckets, the share page's
// sere lookup, the delete-my-data file sweep) go through the Supabase Edge Function "sota-server"
// (supabase/functions/sota-server) instead of straight to Supabase with the service key.
// The Worker holds only SOTA_SERVER_SECRET, a random value shared with that function; the function
// holds the service key and repeats only the requests on its own short list.
// The request shapes are the same as before; only the base address and the key header change.
const SOTA_URL='https://xnxmumbvgtmlpenutlii.supabase.co';
const SERVICE_URL=`${SOTA_URL}/functions/v1/sota-server`;
// A key must look like a key (letters, digits, . _ -). A value pasted wrong (code, a line break) used to reach
// fetch and fail as 'invalid header value'; now it is reported as the plain 'config' fault.
const KEY_SHAPE=/^[A-Za-z0-9._-]{32,}$/;
function svcHeaders(env,extra){
  const key=String(env.SOTA_SERVER_SECRET||'');
  if(!KEY_SHAPE.test(key))throw Error('config');
  return Object.assign({'x-sota-bridge':key},extra||{});
}
module.exports={SOTA_URL,SERVICE_URL,KEY_SHAPE,svcHeaders};
