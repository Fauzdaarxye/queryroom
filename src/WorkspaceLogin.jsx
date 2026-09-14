import React, {useState} from 'react';
import {Braces, LockKeyhole, LoaderCircle} from 'lucide-react';

export default function WorkspaceLogin({onUnlock}) {
  const [password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function unlock(event) {
    event.preventDefault();setBusy(true);setError('');
    try {await onUnlock(password);window.location.reload();}
    catch(error) {setError(error.message);setBusy(false);}
  }
  return <main className="loading-screen"><div className="brand-mark"><Braces size={25}/></div><h1>queryroom<span>.</span></h1><form className="workspace-login" onSubmit={unlock}><LockKeyhole size={23}/><h2>Your private practice space</h2><p>Enter your workspace password to continue.</p><label htmlFor="workspace-password">Workspace password</label><input id="workspace-password" type="password" autoComplete="current-password" value={password} maxLength={512} onChange={e=>setPassword(e.target.value)} required autoFocus/>{error&&<p className="error-text" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy?<LoaderCircle className="spin" size={15}/>:<LockKeyhole size={15}/>}Unlock workspace</button></form></main>;
}
