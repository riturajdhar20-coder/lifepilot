import { useEffect, useMemo, useState } from 'react';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { deleteMyData, listData, saveRecord } from 'zitejs/api';
import {
  CalendarDays, Check, ChevronDown, CircleDollarSign, FileText,
  LayoutDashboard, LogOut, Plus, Search, Settings, ShieldCheck, Sparkles,
  SquareCheckBig, Trash2, UserRound, X, Clock3, Menu, Loader2, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';
import InstallAppPopover from './components/InstallAppPopover';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';

type Tab = 'Overview' | 'Tasks' | 'Bills' | 'Documents' | 'Appointments' | 'Settings';
type Row = { id: string; title?: string; bill?: string; document?: string; appointment?: string; dueDate?: string; expiryDate?: string; startsAt?: string; status?: string; priority?: string; amount?: number; category?: string; notes?: string; location?: string };
type Data = { tasks: Row[]; bills: Row[]; documents: Row[]; appointments: Row[] };
const empty: Data = { tasks: [], bills: [], documents: [], appointments: [] };
const nav: {label:Tab; icon:any}[] = [
  {label:'Overview',icon:LayoutDashboard},{label:'Tasks',icon:SquareCheckBig},
  {label:'Bills',icon:CircleDollarSign},{label:'Documents',icon:FileText},
  {label:'Appointments',icon:CalendarDays},{label:'Settings',icon:Settings}
];
const titleFor: Record<Exclude<Tab,'Overview'|'Settings'>, keyof Data> = {Tasks:'tasks',Bills:'bills',Documents:'documents',Appointments:'appointments'};
const tableFor: Record<Exclude<Tab,'Overview'|'Settings'>, 'Tasks'|'Bills'|'Documents'|'Appointments'> = {Tasks:'Tasks',Bills:'Bills',Documents:'Documents',Appointments:'Appointments'};
const fieldFor: Record<Exclude<Tab,'Overview'|'Settings'>, string> = {Tasks:'title',Bills:'bill',Documents:'document',Appointments:'appointment'};
const prettyDate = (value?: string) => { if (!value) return 'No date'; const date = new Date(value.length===10 ? value+'T00:00:00' : value); return new Intl.DateTimeFormat('en-IN', value.length===10 ? {day:'2-digit',month:'short',year:'numeric'} : {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date); };
const dateInput = (value?: string) => value ? value.slice(0,10) : '';
const money = (value?: number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value||0);

function App() {
  const { user, isLoading } = useAuth();
  const [tab,setTab]=useState<Tab>('Overview');
  const [data,setData]=useState<Data>(empty);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [addOpen,setAddOpen]=useState(false);
  const [mobileMenu,setMobileMenu]=useState(false);
  const [collapsed,setCollapsed]=useState(()=>localStorage.getItem('lp-collapsed')==='1');
  const [saving,setSaving]=useState(false);
  const [erasing,setErasing]=useState(false);
  const [confirmErase,setConfirmErase]=useState(false);
  const setNotice=(m:string)=>{ if(!m) return; /could not|failed/i.test(m)?toast.error(m):toast.success(m); };
  useEffect(()=>{ localStorage.setItem('lp-collapsed',collapsed?'1':'0'); },[collapsed]);
  const go=(t:Tab,add=false)=>{ setTab(t); setSearch(''); setDraft({}); setAddOpen(add); setMobileMenu(false); };
  const keyOf=(table:string)=>table.toLowerCase() as keyof Data;
  const toggleTask=async(t:Row)=>{
    const next=t.status==='Done'?'To do':'Done'; const prev=data;
    setData(d=>({...d,tasks:d.tasks.map(x=>x.id===t.id?{...x,status:next}:x)}));
    try { await saveRecord({table:'Tasks',action:'save',id:t.id,fields:{status:next}}); }
    catch { setData(prev); toast.error('Could not update this task.'); }
  };
  const toggleBill=async(b:Row)=>{
    const next=b.status==='Paid'?'Unpaid':'Paid'; const prev=data;
    setData(d=>({...d,bills:d.bills.map(x=>x.id===b.id?{...x,status:next}:x)}));
    try { await saveRecord({table:'Bills',action:'save',id:b.id,fields:{status:next}}); }
    catch { setData(prev); toast.error('Could not update this bill.'); }
  };
  const [draft,setDraft]=useState<Record<string,string>>({});

  useEffect(()=>{ if(!isLoading && !user) loginWithRedirect(); },[isLoading,user]);
  const refresh=async()=>{
    try { const result=await listData({}); setData(result as Data); }
    catch { setNotice('Could not load your records. Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ if(user) void refresh(); },[user?.id]);
  const greeting=user?.firstName || user?.name?.split(' ')[0] || 'there';
  const today=new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  const openBills=data.bills.filter(x=>x.status!=='Paid');
  const dueSoon=data.documents.filter(x=>x.expiryDate && new Date(x.expiryDate+'T00:00:00').getTime()-Date.now()<1000*60*60*24*45 && new Date(x.expiryDate+'T00:00:00').getTime()>Date.now());
  const overdueTasks=data.tasks.filter(x=>x.status!=='Done' && x.dueDate && new Date(x.dueDate+'T00:00:00')<new Date(new Date().toDateString()));
  const startOfToday=new Date(new Date().toDateString()).getTime();
  const upcoming=[...openBills.map(x=>({name:x.bill,date:x.dueDate,type:'Bill'})),...data.appointments.filter(x=>x.startsAt&&new Date(x.startsAt).getTime()>=startOfToday).map(x=>({name:x.appointment,date:x.startsAt,type:'Appointment'}))]
    .sort((a,b)=>(a.date?new Date(a.date).getTime():Infinity)-(b.date?new Date(b.date).getTime():Infinity)).slice(0,4);
  const save=async(fields:Record<string,unknown>,id?:string)=>{
    if(tab==='Overview'||tab==='Settings') return;
    setSaving(true);
    try { await saveRecord({table:tableFor[tab],action:'save',...(id?{id}:{}),fields}); setDraft({}); setAddOpen(false); setNotice('Saved successfully.'); await refresh(); }
    catch { setNotice('Could not save this item. Please check the details and try again.'); }
    finally { setSaving(false); }
  };
  const remove=async(table:'Tasks'|'Bills'|'Documents'|'Appointments',id:string)=>{
    const prev=data; const k=keyOf(table);
    setData(d=>({...d,[k]:d[k].filter(x=>x.id!==id)}));
    try { await saveRecord({table,action:'delete',id,fields:{}}); toast.success('Item deleted.'); }
    catch { setData(prev); toast.error('Could not delete this item.'); }
  };
  const eraseMyData=async()=>{
    setErasing(true);
    try { const result=await deleteMyData({}); setData(empty); setConfirmErase(false); go('Overview'); setNotice(`Deleted ${result.deletedCount} LifePilot records.`); }
    catch { setNotice('Could not delete your LifePilot data. Please try again.'); }
    finally { setErasing(false); }
  };
  const collection = tab!=='Overview'&&tab!=='Settings' ? data[titleFor[tab]] : [];
  const filtered=collection.filter(row=>Object.values(row).some(v=>String(v??'').toLowerCase().includes(search.toLowerCase())));
  const label=(row:Row)=>tab==='Tasks'?row.title:tab==='Bills'?row.bill:tab==='Documents'?row.document:row.appointment;
  const due=(row:Row)=>tab==='Tasks'||tab==='Bills'?row.dueDate:tab==='Documents'?row.expiryDate:row.startsAt;
  const dueLabel=tab==='Documents'?'Expires':tab==='Appointments'?'When':'Due';
  const submit=(e:React.FormEvent)=>{
    e.preventDefault();
    if(tab==='Tasks') void save({title:draft.title,status:'To do',priority:draft.priority||'Medium',dueDate:draft.dueDate||null,notes:draft.notes||''});
    if(tab==='Bills') void save({bill:draft.title,amount:Number(draft.amount||0),status:'Unpaid',dueDate:draft.dueDate||null,category:draft.category||'',notes:draft.notes||''});
    if(tab==='Documents') void save({document:draft.title,category:draft.category||'',expiryDate:draft.dueDate||null,reminderDate:draft.reminderDate||null,notes:draft.notes||''});
    if(tab==='Appointments') void save({appointment:draft.title,startsAt:draft.dueDate?new Date(draft.dueDate+'T'+(draft.time||'09:00')).toISOString():null,location:draft.location||'',notes:draft.notes||''});
  };
  if(isLoading || (!user && !isLoading)) return <div className="auth-loading"><div className="brand-mark">L</div><p>Opening your private space…</p></div>;

  return <div className="app-shell">
    <Toaster />
    <InstallAppPopover />
    <aside className={'sidebar '+(mobileMenu?'show ':'')+(collapsed?'collapsed':'')}>
      <div className="brand"><div className="brand-mark">L</div><div><strong>LifePilot</strong><span>PERSONAL HUB</span></div><button className="mobile-close" onClick={()=>setMobileMenu(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="side-label">WORKSPACE</div>
      <nav>{nav.map(item=><button key={item.label} title={collapsed?item.label:undefined} onClick={()=>go(item.label)} className={'nav-item '+(tab===item.label?'active':'')}><item.icon size={18}/><span>{item.label}</span>{item.label==='Bills'&&openBills.length>0&&<i>{openBills.length}</i>}</button>)}</nav>
      <div className="sidebar-foot"><button className="collapse-btn" onClick={()=>setCollapsed(!collapsed)} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'}>{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}<span>Collapse</span></button><div className="secure-note"><ShieldCheck size={17}/><span>Your data is private<br/>to your account</span></div><button className="profile-row" title={collapsed?'Settings':undefined} onClick={()=>go('Settings')}><div className="avatar">{greeting[0]?.toUpperCase()}</div><div className="profile-meta"><b>{greeting}</b><span>Personal account</span></div><ChevronDown size={15}/></button></div>
    </aside>
    {mobileMenu&&<div className="scrim" onClick={()=>setMobileMenu(false)}/>}
    <main className="main">
      <header className="topbar"><button className="mobile-menu" aria-label="Open menu" onClick={()=>setMobileMenu(true)}><Menu size={20}/></button><div className="crumb">LifePilot <span>/</span> <b>{tab}</b></div><div className="top-actions"><div className="today"><CalendarDays size={15}/>{today}</div><div className="avatar small">{greeting[0]?.toUpperCase()}</div></div></header>
      <div className="content">
        {tab==='Overview'?<><section className="welcome"><div><p className="eyebrow">{today.toUpperCase()}</p><h1>Good day, {greeting} <span>✦</span></h1><p className="subhead">A little clarity for everything on your plate.</p></div><button className="primary-btn" onClick={()=>go('Tasks',true)}><Plus size={16}/> Add a task</button></section>
          {loading?<div className="stat-grid">{[0,1,2,3].map(i=><div className="stat-card" key={i}><Skeleton className="h-4 w-24"/><Skeleton className="h-7 w-16 mt-3"/><Skeleton className="h-3 w-32 mt-auto"/></div>)}</div>:<div className="stat-grid">{[
            {label:'Open tasks',icon:SquareCheckBig,value:String(data.tasks.filter(x=>x.status!=='Done').length),sub:overdueTasks.length?overdueTasks.length+' overdue':'Keep your day moving',alert:overdueTasks.length>0},
            {label:'Unpaid bills',icon:CircleDollarSign,value:money(openBills.reduce((n,b)=>n+(b.amount||0),0)),sub:openBills.length+' '+(openBills.length===1?'payment':'payments')+' to track',alert:false},
            {label:'Expiring soon',icon:FileText,value:String(dueSoon.length),sub:'Documents in the next 45 days',alert:false},
            {label:'Appointments',icon:CalendarDays,value:String(data.appointments.length),sub:'All your plans, in one place',alert:false},
          ].map(c=><div className="stat-card" key={c.label}><div className="stat-top"><span>{c.label}</span><div className="stat-icon"><c.icon size={16}/></div></div><strong title={c.value}>{c.value}</strong><small className={c.alert?'alert':''}>{c.sub}</small></div>)}</div>}
          <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h2>Today’s focus</h2><p>Your next steps, all together</p></div><button className="text-btn" onClick={()=>go('Tasks')}>All tasks <span>→</span></button></div>{loading?[0,1,2,3].map(i=><div className="sk-row" key={i}><Skeleton className="h-5 w-5 rounded-full"/><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3"/><Skeleton className="h-3 w-1/3"/></div></div>):data.tasks.filter(x=>x.status!=='Done').slice(0,4).map(t=><div className="focus-row" key={t.id}><button className="check-circle" title="Mark done" aria-label="Mark done" onClick={()=>void toggleTask(t)}><Check size={13}/></button><div className="focus-copy"><b>{t.title}</b><span>{t.dueDate?'Due '+prettyDate(t.dueDate):'No due date'}</span></div><span className={'pill '+(t.priority==='High'?'red':t.priority==='Low'?'gray':'amber')}>{t.priority||'Medium'}</span></div>)}{!loading&&data.tasks.filter(x=>x.status!=='Done').length===0&&<div className="empty"><div className="empty-icon"><Sparkles size={19}/></div><b>A clear runway</b><span>Add a task when something comes to mind.</span><button className="text-btn" onClick={()=>go('Tasks',true)}>Create your first task →</button></div>}</section>
          <section className="panel"><div className="panel-head"><div><h2>Coming up</h2><p>Bills and dates worth a glance</p></div><Clock3 size={16} className="muted-icon"/></div>{loading?[0,1,2].map(i=><div className="sk-row" key={i}><Skeleton className="h-11 w-10"/><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2"/><Skeleton className="h-3 w-1/4"/></div></div>):upcoming.map((x,i)=><div className="coming-row" key={i}><div className="date-chip"><b>{x.date?new Date(x.date).getDate():'—'}</b><span>{x.date?new Intl.DateTimeFormat('en-IN',{month:'short'}).format(new Date(x.date)):'DATE'}</span></div><div className="focus-copy"><b>{x.name}</b><span>{x.type}</span></div><span className="coming-date">{x.date?prettyDate(x.date):'—'}</span></div>)}{!loading&&upcoming.length===0&&<div className="empty"><div className="empty-icon"><CalendarDays size={18}/></div><b>Nothing pressing</b><span>Your schedule will show up here.</span></div>}</section></div>
          <div className="bottom-note"><ShieldCheck size={15}/> Your LifePilot is personal. Your records are scoped to your signed-in account.</div></>
        :tab==='Settings'?<><section className="page-title"><p className="eyebrow">YOUR SPACE</p><h1>Settings</h1><p className="subhead">Manage your account and privacy.</p></section><section className="settings-card"><div className="setting-icon"><UserRound size={19}/></div><div className="setting-copy"><h3>Account</h3><p>{user?.email||'Signed-in account'} · Your account is secured by Zite sign-in.</p></div><button className="secondary-btn" onClick={()=>void logout()}>Sign out <LogOut size={15}/></button></section><section className="settings-card"><div className="setting-icon"><ShieldCheck size={19}/></div><div className="setting-copy"><h3>Privacy by account</h3><p>Your tasks, bills, document expiry dates, and appointments are only returned by authenticated workflows scoped to your signed-in account.</p></div><span className="private-tag">PRIVATE</span></section><section className="settings-card"><div className="setting-icon"><FileText size={19}/></div><div className="setting-copy"><h3>Document details</h3><p>LifePilot stores names and expiry dates only. Do not upload identity scans or other sensitive files.</p></div></section><section className="settings-card danger-card"><div className="setting-icon danger-icon"><Trash2 size={18}/></div><div className="setting-copy"><h3>Delete LifePilot data</h3><p>Permanently erase your tasks, bills, expiry records, appointments, and preferences from this workspace.</p></div><button className="danger-btn" onClick={()=>setConfirmErase(true)}>Delete my data</button></section><div className="deletion-note"><b>Delete your Zite account too?</b><p>This MVP can erase LifePilot records, but Zite does not expose account deletion to the app. Contact the workspace owner to remove your sign-in account.</p></div></>
        :<><section className="page-title"><p className="eyebrow">YOUR PERSONAL HUB</p><h1>{tab}</h1><p className="subhead">{tab==='Tasks'?'Small steps add up. Keep your next actions clear.':tab==='Bills'?'Stay ahead of due dates and keep payments visible.':tab==='Documents'?'Track expiry dates without storing document scans.':'Keep appointments and important details in one calm place.'}</p></section>
          <div className="list-toolbar"><div className="search-box"><Search size={16}/><input placeholder={'Search '+tab.toLowerCase()+'…'} value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="Clear search" onClick={()=>setSearch('')}><X size={14}/></button>}</div><button className="primary-btn" onClick={()=>setAddOpen(!addOpen)}>{addOpen?<X size={16}/>:<Plus size={16}/>}{addOpen?'Close':'Add '+tab.slice(0,-1).toLowerCase()}</button></div>
          {addOpen&&<form className="add-form" onSubmit={submit}><div className="form-head"><div><b>New {tab.slice(0,-1).toLowerCase()}</b><span>Only you can see this entry.</span></div></div><div className="form-grid"><label>{tab==='Tasks'?'Task title':tab==='Bills'?'Bill name':tab==='Documents'?'Document name':'Appointment'}<input autoFocus required value={draft.title||''} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Add a name"/></label>
            {tab==='Bills'&&<label>Amount (₹)<input type="number" min="0" step="0.01" value={draft.amount||''} onChange={e=>setDraft({...draft,amount:e.target.value})} placeholder="0"/></label>}
            {tab==='Tasks'&&<label>Priority<select value={draft.priority||'Medium'} onChange={e=>setDraft({...draft,priority:e.target.value})}><option>Low</option><option>Medium</option><option>High</option></select></label>}
            {tab==='Documents'&&<label>Category<input value={draft.category||''} onChange={e=>setDraft({...draft,category:e.target.value})} placeholder="e.g. Passport"/></label>}
            {tab==='Bills'&&<label>Category<input value={draft.category||''} onChange={e=>setDraft({...draft,category:e.target.value})} placeholder="e.g. Utilities"/></label>}
            {tab==='Appointments'&&<label>Location<input value={draft.location||''} onChange={e=>setDraft({...draft,location:e.target.value})} placeholder="Optional"/></label>}
            {tab==='Appointments'?<><label>Date<input required type="date" value={draft.dueDate||''} onChange={e=>setDraft({...draft,dueDate:e.target.value})}/></label><label>Time<input type="time" value={draft.time||'09:00'} onChange={e=>setDraft({...draft,time:e.target.value})}/></label></>:<label>{tab==='Documents'?'Expiry date':'Due date'}<input type="date" value={draft.dueDate||''} onChange={e=>setDraft({...draft,dueDate:e.target.value})}/></label>}
            {tab==='Documents'&&<label>Reminder date<input type="date" value={draft.reminderDate||''} onChange={e=>setDraft({...draft,reminderDate:e.target.value})}/></label>}
            <label className="wide">Notes<input value={draft.notes||''} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Optional details"/></label></div><div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setAddOpen(false)}>Cancel</button><button className="primary-btn" type="submit" disabled={saving}>{saving?<Loader2 size={15} className="spin"/>:<Check size={15}/>}{saving?'':' '+tab.slice(0,-1).toLowerCase()}</button></div></form>}
          <section className="records-panel">{loading?[0,1,2,3,4].map(i=><div className="sk-row" key={i}><Skeleton className="h-9 w-9"/><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3"/><Skeleton className="h-3 w-1/5"/></div><Skeleton className="h-4 w-20"/></div>):filtered.length===0?<div className="empty"><div className="empty-icon">{tab==='Bills'?<CircleDollarSign size={19}/>:tab==='Documents'?<FileText size={19}/>:tab==='Appointments'?<CalendarDays size={19}/>:<SquareCheckBig size={19}/>}</div><b>{search?'No matches found':'Your '+tab.toLowerCase()+' list is clear'}</b><span>{search?'Try another search.':'Add your first item to get started.'}</span>{!search&&<button className="text-btn" onClick={()=>setAddOpen(true)}>{'Add '+tab.slice(0,-1).toLowerCase()+' →'}</button>}</div>:filtered.map(row=><div className={'record-row'+(row.status==='Done'?' is-done':'')} key={row.id}><div className="record-mark">{tab==='Tasks'?<SquareCheckBig size={17}/>:tab==='Bills'?<CircleDollarSign size={17}/>:tab==='Documents'?<FileText size={17}/>:<CalendarDays size={17}/>}</div><div className="record-copy"><b>{label(row)||'Untitled'}</b><span>{tab==='Bills'?money(row.amount)+' · ':''}{row.category||row.location||row.notes||''}</span></div><div className="record-date"><span>{dueLabel}</span><b>{prettyDate(due(row))}</b></div>{tab==='Tasks'?<div className="pill-slot"><button title="Toggle status" onClick={()=>void toggleTask(row)} className={'pill pill-btn '+(row.status==='Done'?'green':'amber')}>{row.status||'To do'}</button></div>:tab==='Bills'?<div className="pill-slot"><button title="Toggle paid" onClick={()=>void toggleBill(row)} className={'pill pill-btn '+(row.status==='Paid'?'green':'red')}>{row.status||'Unpaid'}</button></div>:null}<button className="delete-btn" title="Delete item" aria-label="Delete item" onClick={()=>void remove(tableFor[tab],row.id)}><Trash2 size={16}/></button></div>)}</section></>}
      </div><footer className="footer">LifePilot <span>·</span> A little more in control, every day.</footer>
    </main>
    <AlertDialog open={confirmErase} onOpenChange={o=>!erasing&&setConfirmErase(o)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete all LifePilot data?</AlertDialogTitle><AlertDialogDescription>This permanently erases your tasks, bills, document expiry records, appointments, and preferences. Your sign-in account will remain.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={erasing}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={erasing} onClick={e=>{e.preventDefault();void eraseMyData();}}>{erasing&&<Loader2 size={15} className="spin mr-2"/>}Delete everything</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
export default App;
