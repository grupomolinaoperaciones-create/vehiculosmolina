import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

/* ── Constants ── */
const CAMPOS = ['Las Mercedes','Santa Maria','La Navidad','Los Vergeles','Don Roberto','Administración','MJ1','MJ3','MJ4','MJ5','MJ6','MJ8']
const CAMPO_COLORS = {'Las Mercedes':'#1D9E75','Santa Maria':'#378ADD','La Navidad':'#D85A30','Los Vergeles':'#534AB7','Don Roberto':'#BA7517','Administración':'#D4537E','MJ1':'#639922','MJ3':'#0E7C86'}
const TIPOS_MTTO = ['Preventivo','Correctivo','Emergencia']
const ESTADOS_MTTO = ['En proceso','Completado','Pendiente','Cancelado']
const MARCAS = ['NISSAN','CHEVROLET','FORD','TOYOTA','JEEP','CHRYSLER','RENAULT','SUZUKI','HYUNDAI','GM','KUBOTA','Otra']
const COLORS = ['#1D9E75','#378ADD','#D85A30','#BA7517','#534AB7','#D4537E','#639922','#E24B4A']

const NAV = [
  {id:'dashboard',label:'Dashboard',emoji:'📊'},
  {id:'vehiculos',label:'Vehículos',emoji:'🚗'},
  {id:'mtto',label:'Mantenimientos',emoji:'🔧'},
  {id:'combustible',label:'Combustible',emoji:'⛽'},
  {id:'viaticos',label:'Viáticos / Casetas',emoji:'🛣️'},
  {id:'analisis',label:'Análisis',emoji:'📈'},
]

/* ── UI Primitives ── */
function Badge({color='info',children}){
  const m={success:{bg:'#E1F5EE',c:'#0F6E56'},warning:{bg:'#FAEEDA',c:'#854F0B'},danger:{bg:'#FCEBEB',c:'#A32D2D'},info:{bg:'#E6F1FB',c:'#185FA5'},gray:{bg:'#F1EFE8',c:'#5F5E5A'},purple:{bg:'#EEEDFE',c:'#3C3489'}}
  const s=m[color]||m.info
  return <span style={{background:s.bg,color:s.c,fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:4,whiteSpace:'nowrap'}}>{children}</span>
}
function Stat({label,value,sub,color='#1D9E75'}){
  return <div style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:'14px 16px',flex:1,minWidth:130}}>
    <p style={{fontSize:11,color:'var(--text2)',margin:'0 0 4px'}}>{label}</p>
    <p style={{fontSize:22,fontWeight:600,margin:0,color}}>{value}</p>
    {sub&&<p style={{fontSize:11,color:'var(--text3)',margin:'2px 0 0'}}>{sub}</p>}
  </div>
}
function Card({title,children}){
  return <div style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:12,padding:'14px 16px'}}>
    {title&&<p style={{margin:'0 0 12px',fontSize:13,fontWeight:600}}>{title}</p>}
    {children}
  </div>
}
function Modal({title,onClose,children,wide}){
  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
    <div style={{background:'var(--bg)',borderRadius:14,padding:'20px 24px',width:'100%',maxWidth:wide?680:560,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.18)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <h3 style={{margin:0,fontSize:16,fontWeight:600}}>{title}</h3>
        <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:'var(--text2)',lineHeight:1,padding:'0 4px'}}>×</button>
      </div>
      {children}
    </div>
  </div>
}
function Field({label,children}){
  return <div style={{marginBottom:12}}>
    {label&&<label style={{display:'block',fontSize:12,color:'var(--text2)',marginBottom:4,fontWeight:500}}>{label}</label>}
    {children}
  </div>
}
function Btn({onClick,color='#1D9E75',outline,children,small,disabled}){
  return <button onClick={onClick} disabled={disabled} style={{background:outline?'transparent':color,color:outline?color:'#fff',border:`0.5px solid ${outline?color:'transparent'}`,borderRadius:8,padding:small?'5px 12px':'8px 18px',fontSize:small?12:13,fontWeight:500,opacity:disabled?0.5:1}}>{children}</button>
}
function Spinner(){return <div style={{textAlign:'center',padding:40,color:'var(--text3)',fontSize:13}}>Cargando...</div>}
function EmptyState({msg}){return <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text3)',fontSize:13}}>🚗 {msg}</div>}

/* ── Dashboard ── */
function Dashboard({vehiculos,mtto,combustible,viaticos}){
  const totalVeh = vehiculos.length
  const activos = vehiculos.filter(v=>v.activo).length
  const totalMttoCosto = mtto.reduce((s,m)=>s+(+m.mano_obra||0)+(+m.refacciones||0),0)
  const totalLitros = combustible.reduce((s,c)=>s+(+c.litros||0),0)
  const totalCombCosto = combustible.reduce((s,c)=>s+(+c.costo||0),0)
  const totalViaticos = viaticos.reduce((s,v)=>s+(+v.monto||0),0)

  const byMarca = useMemo(()=>{
    const m={}; vehiculos.forEach(v=>{m[v.marca]=(m[v.marca]||0)+1})
    return Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,8)
  },[vehiculos])

  const byCampo = useMemo(()=>{
    const m={}; vehiculos.forEach(v=>{if(v.campo)m[v.campo]=(m[v.campo]||0)+1})
    return Object.entries(m).map(([campo,total])=>({campo,total}))
  },[vehiculos])

  const mttoByMes = useMemo(()=>{
    const m={}
    mtto.forEach(r=>{
      const mes=r.fecha?.substring(0,7)||'?'
      if(!m[mes])m[mes]={mes,costo:0,count:0}
      m[mes].costo+=(+r.mano_obra||0)+(+r.refacciones||0)
      m[mes].count++
    })
    return Object.values(m).sort((a,b)=>a.mes.localeCompare(b.mes)).slice(-6)
  },[mtto])

  const combByMes = useMemo(()=>{
    const m={}
    combustible.forEach(r=>{
      const mes=r.fecha?.substring(0,7)||'?'
      if(!m[mes])m[mes]={mes,litros:0,costo:0}
      m[mes].litros+=(+r.litros||0)
      m[mes].costo+=(+r.costo||0)
    })
    return Object.values(m).sort((a,b)=>a.mes.localeCompare(b.mes)).slice(-6)
  },[combustible])

  return <div>
    <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 16px'}}>Dashboard general</h2>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:20}}>
      <Stat label="Vehículos activos" value={activos} sub={`de ${totalVeh} total`} color="#1D9E75"/>
      <Stat label="Costo mantenimientos" value={`$${totalMttoCosto.toLocaleString()}`} sub={`${mtto.length} registros`} color="#378ADD"/>
      <Stat label="Total litros combustible" value={totalLitros.toLocaleString()} sub={`$${totalCombCosto.toLocaleString()} pesos`} color="#D85A30"/>
      <Stat label="Viáticos / Casetas" value={`$${totalViaticos.toLocaleString()}`} sub={`${viaticos.length} registros`} color="#BA7517"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
      <Card title="Vehículos por marca">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byMarca} layout="vertical" margin={{left:60,right:16}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
            <XAxis type="number" tick={{fontSize:11}}/>
            <YAxis dataKey="name" type="category" tick={{fontSize:11}} width={60}/>
            <Tooltip/>
            <Bar dataKey="value" fill="#1D9E75" radius={[0,4,4,0]} name="Unidades"/>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Vehículos por campo">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={byCampo} dataKey="total" nameKey="campo" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({campo,percent})=>`${campo?.split(' ')[0]} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
              {byCampo.map((e,i)=><Cell key={i} fill={CAMPO_COLORS[e.campo]||COLORS[i%COLORS.length]}/>)}
            </Pie>
            <Tooltip/>
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <Card title="Costo de mantenimientos por mes">
        {mttoByMes.length===0?<EmptyState msg="Sin datos"/>:
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={mttoByMes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
            <XAxis dataKey="mes" tick={{fontSize:11}}/>
            <YAxis tick={{fontSize:11}}/>
            <Tooltip formatter={v=>[`$${v.toLocaleString()}`,'Costo']}/>
            <Bar dataKey="costo" fill="#378ADD" radius={[4,4,0,0]} name="Costo $"/>
          </BarChart>
        </ResponsiveContainer>}
      </Card>
      <Card title="Consumo de combustible por mes (lts)">
        {combByMes.length===0?<EmptyState msg="Sin datos"/>:
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={combByMes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
            <XAxis dataKey="mes" tick={{fontSize:11}}/>
            <YAxis tick={{fontSize:11}}/>
            <Tooltip/>
            <Line type="monotone" dataKey="litros" stroke="#D85A30" strokeWidth={2} dot={{r:3}} name="Litros"/>
          </LineChart>
        </ResponsiveContainer>}
      </Card>
    </div>
  </div>
}

/* ── Vehículos ── */
function Vehiculos({vehiculos,setVehiculos,loading}){
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const [filterCampo,setFilterCampo]=useState('Todos')
  const [filterMarca,setFilterMarca]=useState('Todos')
  const [search,setSearch]=useState('')
  const emptyForm={no_economico:'',nombre:'',campo:'Las Mercedes',marca:'NISSAN',modelo:'',año:'',chofer:'',activo:true}
  const [form,setForm]=useState(emptyForm)

  const handleSubmit=async()=>{
    if(!form.no_economico){alert('El número económico es obligatorio');return}
    setSaving(true)
    const {data,error}=await supabase.from('vehiculos').insert([form]).select()
    if(error)alert('Error: '+error.message)
    else{setVehiculos(v=>[...v,data[0]]);setShowForm(false);setForm(emptyForm)}
    setSaving(false)
  }
  const toggleActivo=async(id,activo)=>{
    await supabase.from('vehiculos').update({activo:!activo}).eq('id',id)
    setVehiculos(vs=>vs.map(v=>v.id===id?{...v,activo:!activo}:v))
  }
  const marcas=[...new Set(vehiculos.map(v=>v.marca).filter(Boolean))].sort()
  const rows=vehiculos.filter(v=>
    (filterCampo==='Todos'||v.campo===filterCampo)&&
    (filterMarca==='Todos'||v.marca===filterMarca)&&
    (!search||v.no_economico?.toLowerCase().includes(search.toLowerCase())||v.nombre?.toLowerCase().includes(search.toLowerCase())||v.chofer?.toLowerCase().includes(search.toLowerCase()))
  )
  const byCampo=CAMPOS.reduce((m,c)=>{m[c]=rows.filter(v=>v.campo===c);return m},{})

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <h2 style={{fontSize:18,fontWeight:600,margin:0}}>Flotilla de vehículos</h2>
      <Btn onClick={()=>setShowForm(true)} color="#1D9E75">+ Agregar vehículo</Btn>
    </div>
    <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
      <input type="text" placeholder="Buscar por No. eco, nombre o chofer..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:260}}/>
      <select value={filterCampo} onChange={e=>setFilterCampo(e.target.value)} style={{width:'auto',padding:'7px 12px'}}>
        <option>Todos</option>{CAMPOS.map(c=><option key={c}>{c}</option>)}
      </select>
      <select value={filterMarca} onChange={e=>setFilterMarca(e.target.value)} style={{width:'auto',padding:'7px 12px'}}>
        <option>Todos</option>{marcas.map(m=><option key={m}>{m}</option>)}
      </select>
      <span style={{fontSize:12,color:'var(--text3)',alignSelf:'center'}}>{rows.length} vehículos</span>
    </div>
    {loading?<Spinner/>:rows.length===0?<EmptyState msg="Sin vehículos. Agrega el primero."/>:
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {CAMPOS.filter(c=>byCampo[c]?.length>0).map(campo=><div key={campo}>
        <p style={{fontSize:13,fontWeight:600,color:CAMPO_COLORS[campo]||'#888',marginBottom:10}}>
          {campo} <span style={{fontWeight:400,color:'var(--text3)',fontSize:12}}>({byCampo[campo].length})</span>
        </p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
          {byCampo[campo].map(v=><div key={v.id} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:'12px 14px',opacity:v.activo?1:0.55}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{fontWeight:700,fontSize:15}}>#{v.no_economico}</span>
              <Badge color={v.activo?'success':'gray'}>{v.activo?'Activo':'Inactivo'}</Badge>
            </div>
            <p style={{margin:'0 0 2px',fontSize:12,fontWeight:500,color:'var(--text)'}}>{v.nombre||`${v.marca} ${v.modelo}`}</p>
            <p style={{margin:'0 0 2px',fontSize:11,color:'var(--text2)'}}>{v.marca} {v.modelo} {v.año&&`· ${v.año}`}</p>
            {v.chofer&&<p style={{margin:'0 0 8px',fontSize:11,color:'var(--text3)'}}>👤 {v.chofer}</p>}
            <button onClick={()=>toggleActivo(v.id,v.activo)} style={{fontSize:11,padding:'3px 8px',borderRadius:6,border:'0.5px solid var(--border2)',background:'none',cursor:'pointer',color:'var(--text2)'}}>
              {v.activo?'Desactivar':'Activar'}
            </button>
          </div>)}
        </div>
      </div>)}
    </div>}
    {showForm&&<Modal title="Agregar vehículo" onClose={()=>setShowForm(false)}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
        <Field label="No. económico *"><input type="text" placeholder="100" value={form.no_economico} onChange={e=>setForm(f=>({...f,no_economico:e.target.value}))}/></Field>
        <Field label="Campo">
          <select value={form.campo} onChange={e=>setForm(f=>({...f,campo:e.target.value}))}>
            {CAMPOS.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Marca">
          <select value={form.marca} onChange={e=>setForm(f=>({...f,marca:e.target.value}))}>
            {MARCAS.map(m=><option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Modelo"><input type="text" placeholder="NP 300 Pick Up" value={form.modelo} onChange={e=>setForm(f=>({...f,modelo:e.target.value}))}/></Field>
        <Field label="Año"><input type="number" placeholder="2022" value={form.año} onChange={e=>setForm(f=>({...f,año:e.target.value}))}/></Field>
        <Field label="Nombre completo"><input type="text" placeholder="NISSAN NP 300..." value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></Field>
      </div>
      <Field label="Chofer / Responsable"><input type="text" placeholder="Nombre del chofer" value={form.chofer} onChange={e=>setForm(f=>({...f,chofer:e.target.value}))}/></Field>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
        <Btn outline color="#888" onClick={()=>setShowForm(false)}>Cancelar</Btn>
        <Btn onClick={handleSubmit} disabled={saving}>{saving?'Guardando...':'Agregar'}</Btn>
      </div>
    </Modal>}
  </div>
}

/* ── Mantenimientos ── */
function Mantenimientos({mtto,setMtto,vehiculos,loading}){
  const [showForm,setShowForm]=useState(false)
  const [editId,setEditId]=useState(null)
  const [saving,setSaving]=useState(false)
  const [filterEstado,setFilterEstado]=useState('Todos')
  const [filterCampo,setFilterCampo]=useState('Todos')
  const [fotoPreviews,setFotoPreviews]=useState([])
  const emptyForm={fecha:new Date().toISOString().split('T')[0],vehiculo_id:'',tipo:'Preventivo',descripcion:'',mano_obra:'',refacciones:'',tecnico:'',estado:'Completado',observaciones:'',kilometraje:''}
  const [form,setForm]=useState(emptyForm)

  const openNew=()=>{setEditId(null);setForm(emptyForm);setFotoPreviews([]);setShowForm(true)}
  const openEdit=(m)=>{
    setEditId(m.id)
    setForm({fecha:m.fecha,vehiculo_id:m.vehiculo_id,tipo:m.tipo,descripcion:m.descripcion||'',mano_obra:m.mano_obra||'',refacciones:m.refacciones||'',tecnico:m.tecnico||'',estado:m.estado,observaciones:m.observaciones||'',kilometraje:m.kilometraje||''})
    setFotoPreviews(m.fotos||[])
    setShowForm(true)
  }
  const handleSubmit=async()=>{
    if(!form.vehiculo_id||!form.descripcion){alert('Vehículo y descripción son obligatorios');return}
    setSaving(true)
    const row={...form,mano_obra:+form.mano_obra||0,refacciones:+form.refacciones||0,kilometraje:+form.kilometraje||null,fotos:fotoPreviews}
    if(editId){
      const {error}=await supabase.from('mtto_vehiculos').update(row).eq('id',editId)
      if(error)alert('Error: '+error.message)
      else{setMtto(m=>m.map(x=>x.id===editId?{...x,...row}:x));setShowForm(false)}
    }else{
      const {data,error}=await supabase.from('mtto_vehiculos').insert([row]).select()
      if(error)alert('Error: '+error.message)
      else{setMtto(m=>[data[0],...m]);setShowForm(false)}
    }
    setSaving(false)
  }
  const handleDelete=async(id)=>{
    if(!confirm('¿Eliminar?'))return
    await supabase.from('mtto_vehiculos').delete().eq('id',id)
    setMtto(m=>m.filter(x=>x.id!==id))
  }
  const changeEstado=async(id,estado)=>{
    await supabase.from('mtto_vehiculos').update({estado}).eq('id',id)
    setMtto(m=>m.map(x=>x.id===id?{...x,estado}:x))
  }

  const eColor={Completado:'success','En proceso':'warning',Pendiente:'info',Cancelado:'danger'}
  const tColor={Preventivo:'info',Correctivo:'warning',Emergencia:'danger'}
  const vehMap=Object.fromEntries(vehiculos.map(v=>[v.id,v]))
  const rows=mtto.filter(m=>(filterEstado==='Todos'||m.estado===filterEstado)&&(filterCampo==='Todos'||vehMap[m.vehiculo_id]?.campo===filterCampo))

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <h2 style={{fontSize:18,fontWeight:600,margin:0}}>Mantenimientos</h2>
      <Btn onClick={openNew} color="#378ADD">+ Nuevo mantenimiento</Btn>
    </div>
    <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
      {['Todos',...ESTADOS_MTTO].map(e=><button key={e} onClick={()=>setFilterEstado(e)} style={{padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:500,border:filterEstado===e?'1.5px solid #378ADD':'0.5px solid var(--border)',background:filterEstado===e?'#E6F1FB':'transparent',color:filterEstado===e?'#185FA5':'var(--text2)'}}>{e}</button>)}
      <select value={filterCampo} onChange={e=>setFilterCampo(e.target.value)} style={{width:'auto',padding:'6px 12px',marginLeft:8}}>
        <option>Todos</option>{CAMPOS.map(c=><option key={c}>{c}</option>)}
      </select>
      <span style={{fontSize:12,color:'var(--text3)',alignSelf:'center'}}>{rows.length} registros</span>
    </div>
    {loading?<Spinner/>:rows.length===0?<EmptyState msg="Sin mantenimientos registrados."/>:
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {rows.map(m=>{
        const veh=vehMap[m.vehiculo_id]
        return <div key={m.id} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:12,padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:15,fontWeight:700}}>#{veh?.no_economico||'?'}</span>
              <span style={{fontSize:13,color:'var(--text2)'}}>{veh?.nombre||veh?.marca}</span>
              <Badge color={tColor[m.tipo]||'gray'}>{m.tipo}</Badge>
              <Badge color={eColor[m.estado]||'gray'}>{m.estado}</Badge>
              {veh?.campo&&<Badge color="gray">{veh.campo}</Badge>}
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <span style={{fontSize:12,color:'var(--text3)'}}>{m.fecha}</span>
              {m.kilometraje&&<span style={{fontSize:11,color:'var(--text3)'}}>🔢 {Number(m.kilometraje).toLocaleString()} km</span>}
              <button onClick={()=>openEdit(m)} style={{background:'none',border:'0.5px solid var(--border)',borderRadius:6,color:'#378ADD',cursor:'pointer',fontSize:12,padding:'3px 8px',fontWeight:500}}>✏️</button>
              <button onClick={()=>handleDelete(m.id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16}}>🗑</button>
            </div>
          </div>
          <p style={{margin:'0 0 6px',fontSize:14,fontWeight:500}}>{m.descripcion}</p>
          {m.observaciones&&<p style={{margin:'0 0 8px',fontSize:13,color:'var(--text2)'}}>{m.observaciones}</p>}
          <div style={{display:'flex',gap:16,fontSize:13,color:'var(--text2)',flexWrap:'wrap',alignItems:'center'}}>
            {m.tecnico&&<span>🔧 <strong style={{color:'var(--text)'}}>{m.tecnico}</strong></span>}
            <span>💵 M.O.: <strong style={{color:'#1D9E75'}}>${Number(m.mano_obra).toLocaleString()}</strong></span>
            <span>🔩 Ref.: <strong style={{color:'#D85A30'}}>${Number(m.refacciones).toLocaleString()}</strong></span>
            <strong>Total: ${(Number(m.mano_obra)+Number(m.refacciones)).toLocaleString()}</strong>
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:11,color:'var(--text3)'}}>Estado:</span>
              <select value={m.estado} onChange={e=>changeEstado(m.id,e.target.value)} style={{padding:'3px 8px',borderRadius:6,fontSize:12,border:'0.5px solid var(--border2)',background:'var(--bg2)',color:'var(--text)',width:'auto'}}>
                {ESTADOS_MTTO.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {m.fotos?.length>0&&<div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
            {m.fotos.map((url,i)=><img key={i} src={url} alt="" style={{width:80,height:60,objectFit:'cover',borderRadius:6,border:'0.5px solid var(--border)'}}/>)}
          </div>}
        </div>
      })}
    </div>}

    {showForm&&<Modal title={editId?'Editar mantenimiento':'Nuevo mantenimiento'} onClose={()=>setShowForm(false)} wide>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
        <Field label="Fecha"><input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/></Field>
        <Field label="Vehículo *">
          <select value={form.vehiculo_id} onChange={e=>setForm(f=>({...f,vehiculo_id:e.target.value}))}>
            <option value="">Seleccionar...</option>
            {vehiculos.map(v=><option key={v.id} value={v.id}>#{v.no_economico} — {v.nombre||v.marca+' '+v.modelo} ({v.campo})</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
            {TIPOS_MTTO.map(t=><option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}>
            {ESTADOS_MTTO.map(s=><option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Kilometraje"><input type="number" placeholder="350000" value={form.kilometraje} onChange={e=>setForm(f=>({...f,kilometraje:e.target.value}))}/></Field>
        <Field label="Técnico"><input type="text" placeholder="Nombre del técnico" value={form.tecnico} onChange={e=>setForm(f=>({...f,tecnico:e.target.value}))}/></Field>
        <Field label="Mano de obra ($)"><input type="number" placeholder="0" value={form.mano_obra} onChange={e=>setForm(f=>({...f,mano_obra:e.target.value}))}/></Field>
        <Field label="Refacciones ($)"><input type="number" placeholder="0" value={form.refacciones} onChange={e=>setForm(f=>({...f,refacciones:e.target.value}))}/></Field>
      </div>
      <Field label="Descripción del trabajo *">
        <textarea value={form.descripcion} rows={2} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} style={{resize:'vertical'}}/>
      </Field>
      <Field label="Observaciones">
        <textarea value={form.observaciones} rows={2} onChange={e=>setForm(f=>({...f,observaciones:e.target.value}))} style={{resize:'vertical'}}/>
      </Field>
      {(form.mano_obra||form.refacciones)&&<div style={{background:'var(--bg2)',borderRadius:8,padding:10,marginBottom:12,fontSize:13}}>
        Total: <strong style={{color:'#1D9E75'}}>${((+form.mano_obra||0)+(+form.refacciones||0)).toLocaleString()}</strong>
      </div>}
      <Field label="📷 Fotos del trabajo">
        <label style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 16px',border:'1px dashed var(--border2)',borderRadius:8,cursor:'pointer',fontSize:13,color:'var(--text2)'}}>
          Subir fotos
          <input type="file" accept="image/*" multiple onChange={e=>{const urls=Array.from(e.target.files).map(f=>URL.createObjectURL(f));setFotoPreviews(p=>[...p,...urls])}} style={{display:'none'}}/>
        </label>
        {fotoPreviews.length>0&&<div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
          {fotoPreviews.map((url,i)=><div key={i} style={{position:'relative'}}>
            <img src={url} alt="" style={{width:72,height:56,objectFit:'cover',borderRadius:6}}/>
            <button onClick={()=>setFotoPreviews(p=>p.filter((_,j)=>j!==i))} style={{position:'absolute',top:-4,right:-4,background:'#E24B4A',color:'#fff',border:'none',borderRadius:'50%',width:16,height:16,fontSize:10,cursor:'pointer'}}>×</button>
          </div>)}
        </div>}
      </Field>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
        <Btn outline color="#888" onClick={()=>setShowForm(false)}>Cancelar</Btn>
        <Btn color="#378ADD" onClick={handleSubmit} disabled={saving}>{saving?'Guardando...':(editId?'Guardar cambios':'Guardar')}</Btn>
      </div>
    </Modal>}
  </div>
}

/* ── Combustible ── */
function Combustible({combustible,setCombustible,vehiculos,loading}){
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const emptyForm={fecha:new Date().toISOString().split('T')[0],vehiculo_id:'',litros:'',costo:'',kilometraje:'',tipo_combustible:'Gasolina',estacion:'',operador:''}
  const [form,setForm]=useState(emptyForm)

  const handleSubmit=async()=>{
    if(!form.vehiculo_id||!form.litros){alert('Vehículo y litros son obligatorios');return}
    setSaving(true)
    const row={...form,litros:+form.litros,costo:+form.costo||null,kilometraje:+form.kilometraje||null}
    const {data,error}=await supabase.from('combustible_vehiculos').insert([row]).select()
    if(error)alert('Error: '+error.message)
    else{setCombustible(c=>[data[0],...c]);setShowForm(false);setForm(emptyForm)}
    setSaving(false)
  }
  const handleDelete=async(id)=>{
    if(!confirm('¿Eliminar?'))return
    await supabase.from('combustible_vehiculos').delete().eq('id',id)
    setCombustible(c=>c.filter(x=>x.id!==id))
  }

  const vehMap=Object.fromEntries(vehiculos.map(v=>[v.id,v]))
  const totalLts=combustible.reduce((s,r)=>s+(+r.litros||0),0)
  const totalCosto=combustible.reduce((s,r)=>s+(+r.costo||0),0)

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div>
        <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 2px'}}>Registro de combustible</h2>
        <p style={{fontSize:12,color:'var(--text3)',margin:0}}>{combustible.length} registros · {totalLts.toLocaleString()} lts · ${totalCosto.toLocaleString()}</p>
      </div>
      <Btn onClick={()=>setShowForm(true)} color="#D85A30">+ Nueva carga</Btn>
    </div>
    {loading?<Spinner/>:combustible.length===0?<EmptyState msg="Sin registros de combustible."/>:
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead>
          <tr style={{borderBottom:'0.5px solid var(--border)'}}>
            {['Fecha','Vehículo','Campo','Combustible','Litros','Costo','Km','Estación','Operador',''].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:500,color:'var(--text2)',fontSize:12,whiteSpace:'nowrap'}}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {combustible.map(r=>{
            const veh=vehMap[r.vehiculo_id]
            const pxl=r.litros>0&&r.costo>0?(r.costo/r.litros).toFixed(2):'-'
            return <tr key={r.id} style={{borderBottom:'0.5px solid var(--border)'}}>
              <td style={{padding:'8px 10px',whiteSpace:'nowrap'}}>{r.fecha}</td>
              <td style={{padding:'8px 10px',fontWeight:600}}>#{veh?.no_economico}</td>
              <td style={{padding:'8px 10px'}}><Badge color="gray">{veh?.campo?.split(' ')[0]||'-'}</Badge></td>
              <td style={{padding:'8px 10px'}}>{r.tipo_combustible}</td>
              <td style={{padding:'8px 10px',fontWeight:600,color:'#D85A30'}}>{r.litros} lts</td>
              <td style={{padding:'8px 10px',color:'#1D9E75'}}>{r.costo?`$${Number(r.costo).toLocaleString()}`:'-'}</td>
              <td style={{padding:'8px 10px',fontSize:11,color:'var(--text2)'}}>{r.costo&&r.litros?`$${pxl}/lt`:'-'}</td>
              <td style={{padding:'8px 10px',fontSize:12,color:'var(--text2)'}}>{r.estacion||'-'}</td>
              <td style={{padding:'8px 10px',fontSize:12,color:'var(--text2)'}}>{r.operador||'-'}</td>
              <td style={{padding:'8px 10px'}}><button onClick={()=>handleDelete(r.id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16}}>🗑</button></td>
            </tr>
          })}
        </tbody>
      </table>
    </div>}

    {showForm&&<Modal title="Nueva carga de combustible" onClose={()=>setShowForm(false)}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
        <Field label="Fecha"><input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/></Field>
        <Field label="Vehículo *">
          <select value={form.vehiculo_id} onChange={e=>setForm(f=>({...f,vehiculo_id:e.target.value}))}>
            <option value="">Seleccionar...</option>
            {vehiculos.map(v=><option key={v.id} value={v.id}>#{v.no_economico} — {v.nombre||v.marca} ({v.campo})</option>)}
          </select>
        </Field>
        <Field label="Tipo de combustible">
          <select value={form.tipo_combustible} onChange={e=>setForm(f=>({...f,tipo_combustible:e.target.value}))}>
            {['Gasolina','Diésel','Premium'].map(t=><option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Litros *"><input type="number" step="0.1" placeholder="0" value={form.litros} onChange={e=>setForm(f=>({...f,litros:e.target.value}))}/></Field>
        <Field label="Costo total ($)"><input type="number" placeholder="0" value={form.costo} onChange={e=>setForm(f=>({...f,costo:e.target.value}))}/></Field>
        <Field label="Kilometraje"><input type="number" placeholder="350000" value={form.kilometraje} onChange={e=>setForm(f=>({...f,kilometraje:e.target.value}))}/></Field>
        <Field label="Estación / Lugar"><input type="text" placeholder="OXXO Gas, Pemex..." value={form.estacion} onChange={e=>setForm(f=>({...f,estacion:e.target.value}))}/></Field>
        <Field label="Operador"><input type="text" placeholder="Nombre" value={form.operador} onChange={e=>setForm(f=>({...f,operador:e.target.value}))}/></Field>
      </div>
      {form.litros&&form.costo&&<div style={{background:'var(--bg2)',borderRadius:8,padding:10,marginBottom:12,fontSize:13}}>
        Precio por litro: <strong style={{color:'#D85A30'}}>${(form.costo/form.litros).toFixed(2)}</strong>
      </div>}
      <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
        <Btn outline color="#888" onClick={()=>setShowForm(false)}>Cancelar</Btn>
        <Btn color="#D85A30" onClick={handleSubmit} disabled={saving}>{saving?'Guardando...':'Guardar'}</Btn>
      </div>
    </Modal>}
  </div>
}

/* ── Viáticos ── */
function Viaticos({viaticos,setViaticos,vehiculos,loading}){
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const emptyForm={fecha:new Date().toISOString().split('T')[0],vehiculo_id:'',tipo:'Caseta',monto:'',destino:'',origen:'',operador:'',notas:''}
  const [form,setForm]=useState(emptyForm)

  const handleSubmit=async()=>{
    if(!form.vehiculo_id||!form.monto){alert('Vehículo y monto son obligatorios');return}
    setSaving(true)
    const row={...form,monto:+form.monto}
    const {data,error}=await supabase.from('viaticos_vehiculos').insert([row]).select()
    if(error)alert('Error: '+error.message)
    else{setViaticos(v=>[data[0],...v]);setShowForm(false);setForm(emptyForm)}
    setSaving(false)
  }
  const handleDelete=async(id)=>{
    if(!confirm('¿Eliminar?'))return
    await supabase.from('viaticos_vehiculos').delete().eq('id',id)
    setViaticos(v=>v.filter(x=>x.id!==id))
  }

  const vehMap=Object.fromEntries(vehiculos.map(v=>[v.id,v]))
  const totalMonto=viaticos.reduce((s,r)=>s+(+r.monto||0),0)
  const byCaseta=viaticos.reduce((s,r)=>r.tipo==='Caseta'?s+(+r.monto||0):s,0)
  const byViatico=viaticos.reduce((s,r)=>r.tipo==='Viático'?s+(+r.monto||0):s,0)

  const tipoColor={Caseta:'purple',Viático:'amber',Hospedaje:'info',Alimento:'success',Otro:'gray'}

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
      <div>
        <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 2px'}}>Viáticos y Casetas</h2>
        <p style={{fontSize:12,color:'var(--text3)',margin:0}}>Total: <strong>${totalMonto.toLocaleString()}</strong> · Casetas: ${byCaseta.toLocaleString()} · Viáticos: ${byViatico.toLocaleString()}</p>
      </div>
      <Btn onClick={()=>setShowForm(true)} color="#534AB7">+ Nuevo registro</Btn>
    </div>
    {loading?<Spinner/>:viaticos.length===0?<EmptyState msg="Sin registros de viáticos o casetas."/>:
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead>
          <tr style={{borderBottom:'0.5px solid var(--border)'}}>
            {['Fecha','Vehículo','Tipo','Monto','Origen','Destino','Operador','Notas',''].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:500,color:'var(--text2)',fontSize:12}}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {viaticos.map(r=>{
            const veh=vehMap[r.vehiculo_id]
            return <tr key={r.id} style={{borderBottom:'0.5px solid var(--border)'}}>
              <td style={{padding:'8px 10px',whiteSpace:'nowrap'}}>{r.fecha}</td>
              <td style={{padding:'8px 10px',fontWeight:600}}>#{veh?.no_economico}</td>
              <td style={{padding:'8px 10px'}}><Badge color={tipoColor[r.tipo]||'gray'}>{r.tipo}</Badge></td>
              <td style={{padding:'8px 10px',fontWeight:600,color:'#534AB7'}}>${Number(r.monto).toLocaleString()}</td>
              <td style={{padding:'8px 10px',fontSize:12,color:'var(--text2)'}}>{r.origen||'-'}</td>
              <td style={{padding:'8px 10px',fontSize:12,color:'var(--text2)'}}>{r.destino||'-'}</td>
              <td style={{padding:'8px 10px',fontSize:12,color:'var(--text2)'}}>{r.operador||'-'}</td>
              <td style={{padding:'8px 10px',fontSize:12,color:'var(--text3)',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.notas||'-'}</td>
              <td style={{padding:'8px 10px'}}><button onClick={()=>handleDelete(r.id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16}}>🗑</button></td>
            </tr>
          })}
        </tbody>
      </table>
    </div>}

    {showForm&&<Modal title="Nuevo registro" onClose={()=>setShowForm(false)}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
        <Field label="Fecha"><input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/></Field>
        <Field label="Vehículo *">
          <select value={form.vehiculo_id} onChange={e=>setForm(f=>({...f,vehiculo_id:e.target.value}))}>
            <option value="">Seleccionar...</option>
            {vehiculos.map(v=><option key={v.id} value={v.id}>#{v.no_economico} — {v.nombre||v.marca} ({v.campo})</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
            {['Caseta','Viático','Hospedaje','Alimento','Otro'].map(t=><option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Monto ($) *"><input type="number" placeholder="0" value={form.monto} onChange={e=>setForm(f=>({...f,monto:e.target.value}))}/></Field>
        <Field label="Origen"><input type="text" placeholder="Ciudad origen" value={form.origen} onChange={e=>setForm(f=>({...f,origen:e.target.value}))}/></Field>
        <Field label="Destino"><input type="text" placeholder="Ciudad destino" value={form.destino} onChange={e=>setForm(f=>({...f,destino:e.target.value}))}/></Field>
      </div>
      <Field label="Operador / Chofer"><input type="text" placeholder="Nombre" value={form.operador} onChange={e=>setForm(f=>({...f,operador:e.target.value}))}/></Field>
      <Field label="Notas"><textarea value={form.notas} rows={2} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} style={{resize:'vertical'}}/></Field>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
        <Btn outline color="#888" onClick={()=>setShowForm(false)}>Cancelar</Btn>
        <Btn color="#534AB7" onClick={handleSubmit} disabled={saving}>{saving?'Guardando...':'Guardar'}</Btn>
      </div>
    </Modal>}
  </div>
}

/* ── Análisis ── */
function Analisis({vehiculos,mtto,combustible,viaticos}){
  const vehMap=Object.fromEntries(vehiculos.map(v=>[v.id,v]))

  const topMtto=useMemo(()=>{
    const m={}
    mtto.forEach(r=>{
      const id=r.vehiculo_id; if(!id)return
      if(!m[id])m[id]={id,costo:0,count:0}
      m[id].costo+=(+r.mano_obra||0)+(+r.refacciones||0)
      m[id].count++
    })
    return Object.values(m).sort((a,b)=>b.costo-a.costo).slice(0,10).map(x=>({
      label:`#${vehMap[x.id]?.no_economico||'?'}`,
      costo:x.costo, count:x.count
    }))
  },[mtto,vehMap])

  const topComb=useMemo(()=>{
    const m={}
    combustible.forEach(r=>{
      const id=r.vehiculo_id; if(!id)return
      if(!m[id])m[id]={id,litros:0,costo:0}
      m[id].litros+=(+r.litros||0)
      m[id].costo+=(+r.costo||0)
    })
    return Object.values(m).sort((a,b)=>b.costo-a.costo).slice(0,10).map(x=>({
      label:`#${vehMap[x.id]?.no_economico||'?'}`,
      litros:+x.litros.toFixed(0), costo:x.costo
    }))
  },[combustible,vehMap])

  const byTipoMtto=useMemo(()=>{
    const m={}; mtto.forEach(r=>{m[r.tipo]=(m[r.tipo]||0)+1})
    return Object.entries(m).map(([name,value])=>({name,value}))
  },[mtto])

  const costoTotal=mtto.reduce((s,r)=>s+(+r.mano_obra||0)+(+r.refacciones||0),0)
  const combTotal=combustible.reduce((s,r)=>s+(+r.costo||0),0)
  const viatTotal=viaticos.reduce((s,r)=>s+(+r.monto||0),0)

  return <div>
    <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 16px'}}>Análisis de flotilla</h2>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:20}}>
      <Stat label="Gasto mantenimientos" value={`$${costoTotal.toLocaleString()}`} color="#378ADD"/>
      <Stat label="Gasto combustible" value={`$${combTotal.toLocaleString()}`} color="#D85A30"/>
      <Stat label="Viáticos y casetas" value={`$${viatTotal.toLocaleString()}`} color="#534AB7"/>
      <Stat label="Gasto total flotilla" value={`$${(costoTotal+combTotal+viatTotal).toLocaleString()}`} color="#1D9E75"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
      <Card title="Top vehículos por costo de mantenimiento">
        {topMtto.length===0?<EmptyState msg="Sin datos"/>:
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={topMtto} layout="vertical" margin={{left:30,right:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
            <XAxis type="number" tick={{fontSize:11}}/>
            <YAxis dataKey="label" type="category" tick={{fontSize:11}} width={35}/>
            <Tooltip formatter={v=>[`$${v.toLocaleString()}`,'Costo']}/>
            <Bar dataKey="costo" fill="#378ADD" radius={[0,4,4,0]} name="Costo $"/>
          </BarChart>
        </ResponsiveContainer>}
      </Card>
      <Card title="Top vehículos por consumo de combustible (lts)">
        {topComb.length===0?<EmptyState msg="Sin datos"/>:
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={topComb} layout="vertical" margin={{left:30,right:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
            <XAxis type="number" tick={{fontSize:11}}/>
            <YAxis dataKey="label" type="category" tick={{fontSize:11}} width={35}/>
            <Tooltip formatter={v=>[`${v} lts`,'Combustible']}/>
            <Bar dataKey="litros" fill="#D85A30" radius={[0,4,4,0]} name="Litros"/>
          </BarChart>
        </ResponsiveContainer>}
      </Card>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <Card title="Mantenimientos por tipo">
        {byTipoMtto.length===0?<EmptyState msg="Sin datos"/>:
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={byTipoMtto} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
              {byTipoMtto.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
            </Pie>
            <Tooltip/>
          </PieChart>
        </ResponsiveContainer>}
      </Card>
      <Card title="Distribución de gastos totales">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={[{name:'Mantenimientos',value:costoTotal},{name:'Combustible',value:combTotal},{name:'Viáticos/Casetas',value:viatTotal}].filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({name,percent})=>`${name.split('/')[0]} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
              <Cell fill="#378ADD"/><Cell fill="#D85A30"/><Cell fill="#534AB7"/>
            </Pie>
            <Tooltip formatter={v=>[`$${v.toLocaleString()}`,'']}/>
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  </div>
}

/* ── App Root ── */
export default function App(){
  const [page,setPage]=useState('dashboard')
  const [vehiculos,setVehiculos]=useState([])
  const [mtto,setMtto]=useState([])
  const [combustible,setCombustible]=useState([])
  const [viaticos,setViaticos]=useState([])
  const [loading,setLoading]=useState(true)
  const [dbError,setDbError]=useState(null)

  const loadAll=useCallback(async()=>{
    setLoading(true)
    try{
      const [v,m,c,vi]=await Promise.all([
        supabase.from('vehiculos').select('*').order('no_economico'),
        supabase.from('mtto_vehiculos').select('*').order('fecha',{ascending:false}),
        supabase.from('combustible_vehiculos').select('*').order('fecha',{ascending:false}),
        supabase.from('viaticos_vehiculos').select('*').order('fecha',{ascending:false}),
      ])
      if(v.error||m.error||c.error||vi.error){setDbError('No se pudieron cargar los datos. Verifica que las tablas existan en Supabase.')}
      else{setVehiculos(v.data||[]);setMtto(m.data||[]);setCombustible(c.data||[]);setViaticos(vi.data||[])}
    }catch(e){setDbError('Error: '+e.message)}
    setLoading(false)
  },[])

  useEffect(()=>{loadAll()},[loadAll])

  if(dbError)return <div style={{padding:40,maxWidth:600,margin:'0 auto'}}>
    <div style={{background:'#FCEBEB',border:'1px solid #F09595',borderRadius:12,padding:20}}>
      <h3 style={{color:'#A32D2D',margin:'0 0 8px'}}>⚠️ Error de base de datos</h3>
      <p style={{color:'#791F1F',margin:'0 0 16px',fontSize:14}}>{dbError}</p>
      <p style={{color:'#791F1F',fontSize:13,margin:'0 0 16px'}}>Crea las tablas en Supabase SQL Editor y recarga.</p>
      <button onClick={()=>{setDbError(null);loadAll()}} style={{padding:'8px 18px',borderRadius:8,background:'#A32D2D',color:'#fff',border:'none',cursor:'pointer',fontSize:13}}>Reintentar</button>
    </div>
  </div>

  return <div style={{minHeight:'100vh'}}>
    <div style={{background:'var(--bg)',borderBottom:'0.5px solid var(--border)',position:'sticky',top:0,zIndex:100}}>
      <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',display:'flex',alignItems:'center',gap:0}}>
        <div style={{padding:'12px 20px 12px 0',marginRight:20,borderRight:'0.5px solid var(--border)'}}>
          <p style={{margin:0,fontSize:15,fontWeight:700}}>🚗 FlotillaGM</p>
          <p style={{margin:0,fontSize:10,color:'var(--text3)'}}>Grupo Molina · Vehículos</p>
        </div>
        <nav style={{display:'flex',overflowX:'auto'}}>
          {NAV.map(n=><button key={n.id} onClick={()=>setPage(n.id)} style={{background:'none',border:'none',cursor:'pointer',padding:'14px 12px',fontSize:13,whiteSpace:'nowrap',borderBottom:page===n.id?'2px solid #1D9E75':'2px solid transparent',color:page===n.id?'#0F6E56':'var(--text2)',fontWeight:page===n.id?600:400}}>{n.emoji} {n.label}</button>)}
        </nav>
        <div style={{marginLeft:'auto',paddingLeft:16}}>
          <button onClick={loadAll} style={{background:'none',border:'0.5px solid var(--border2)',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',color:'var(--text2)'}}>↻ Actualizar</button>
        </div>
      </div>
    </div>
    <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 20px'}}>
      {page==='dashboard'&&<Dashboard vehiculos={vehiculos} mtto={mtto} combustible={combustible} viaticos={viaticos}/>}
      {page==='vehiculos'&&<Vehiculos vehiculos={vehiculos} setVehiculos={setVehiculos} loading={loading}/>}
      {page==='mtto'&&<Mantenimientos mtto={mtto} setMtto={setMtto} vehiculos={vehiculos} loading={loading}/>}
      {page==='combustible'&&<Combustible combustible={combustible} setCombustible={setCombustible} vehiculos={vehiculos} loading={loading}/>}
      {page==='viaticos'&&<Viaticos viaticos={viaticos} setViaticos={setViaticos} vehiculos={vehiculos} loading={loading}/>}
      {page==='analisis'&&<Analisis vehiculos={vehiculos} mtto={mtto} combustible={combustible} viaticos={viaticos}/>}
    </div>
  </div>
}
