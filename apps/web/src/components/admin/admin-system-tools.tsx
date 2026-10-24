'use client';
import {FormEvent,useEffect,useState} from 'react';
import {listMailFailures,MailFailure,retryMail,saveDeliveryZone} from '../../lib/client/admin';
import {DeliveryZone,listDeliveryZones} from '../../lib/client/marketplace';
import styles from './admin-dashboard.module.css';

export function AdminSystemTools(){
 const [failures,setFailures]=useState<MailFailure[]>([]),[zones,setZones]=useState<DeliveryZone[]>([]),[name,setName]=useState(''),[state,setState]=useState(''),[city,setCity]=useState(''),[notice,setNotice]=useState('');
 const load=()=>Promise.all([listMailFailures(),listDeliveryZones()]).then(([mail,delivery])=>{setFailures(mail.failures);setZones(delivery.zones);}).catch((error:unknown)=>setNotice(error instanceof Error?error.message:'Could not load system controls.'));
 useEffect(()=>{void load();},[]);
 async function retry(id:string){try{await retryMail(id);setNotice('Email queued for another delivery attempt.');await load();}catch(error){setNotice(error instanceof Error?error.message:'Could not retry email.');}}
 async function createZone(event:FormEvent){event.preventDefault();try{await saveDeliveryZone({name,state,city,active:true,version:0});setName('');setState('');setCity('');setNotice('Delivery zone activated.');await load();}catch(error){setNotice(error instanceof Error?error.message:'Could not create delivery zone.');}}
 return <div className={styles.systemGrid}>{notice&&<div className={styles.notice}>{notice}</div>}<section className={styles.panel}><h2>Delivery coverage</h2><form className={styles.inlineForm} onSubmit={createZone}><input required minLength={2} placeholder="Zone name" value={name} onChange={e=>setName(e.target.value)}/><input required minLength={2} placeholder="State" value={state} onChange={e=>setState(e.target.value)}/><input required minLength={2} placeholder="City" value={city} onChange={e=>setCity(e.target.value)}/><button>Add active zone</button></form>{zones.map(zone=><p className={styles.worker} key={zone.id}><b>{zone.name}</b><span>{zone.city}, {zone.state}</span></p>)}{!zones.length&&<p>No active delivery zones yet.</p>}</section><section className={styles.panel}><h2>Failed email delivery</h2>{failures.map(item=><div className={styles.upload} key={item.id}><span><b>{item.attempts} attempts</b><small>Next retry {new Date(item.next_attempt_at).toLocaleString()}</small></span><button onClick={()=>retry(item.id)}>Retry now</button></div>)}{!failures.length&&<p>No failed email requires attention.</p>}</section></div>;
}
