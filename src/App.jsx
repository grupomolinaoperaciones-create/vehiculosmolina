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
  {id:'presupuesto',label:'Presupuesto',emoji:'📋'},
  {id:'reporte',label:'Reporte',emoji:'📑'},
  {id:'qrcodes',label:'Códigos QR',emoji:'🔲'},
  {id:'viaticos',label:'Viáticos / Casetas',emoji:'🛣️'},
  {id:'analisis',label:'Análisis',emoji:'📈'},
]

/* ── File upload helper (Supabase Storage) ── */
async function uploadFotos(files){
  const urls=[]
  for(const file of files){
    const ext=file.name.split('.').pop()
    const path=`mtto/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const {error}=await supabase.storage.from('mtto-fotos').upload(path,file)
    if(error){
      // fallback to blob URL if storage not configured
      urls.push(URL.createObjectURL(file))
      console.warn('Storage upload failed, using blob URL:',error.message)
      continue
    }
    const {data}=supabase.storage.from('mtto-fotos').getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}

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

/* ── Ficha de vehículo (historial completo imprimible) ── */
function FichaVehiculo({vehiculo, mtto, combustible, viaticos, onClose}){
  const [tab, setTab] = useState('mtto')

  const vMtto = mtto.filter(m=>m.vehiculo_id===vehiculo.id).sort((a,b)=>b.fecha?.localeCompare(a.fecha))
  const vComb = combustible.filter(c=>c.vehiculo_id===vehiculo.id).sort((a,b)=>b.fecha?.localeCompare(a.fecha))
  const vViat = viaticos.filter(v=>v.vehiculo_id===vehiculo.id).sort((a,b)=>b.fecha?.localeCompare(a.fecha))

  const totalMtto   = vMtto.reduce((s,m)=>s+(+m.mano_obra||0)+(+m.refacciones||0),0)
  const totalMO     = vMtto.reduce((s,m)=>s+(+m.mano_obra||0),0)
  const totalRef    = vMtto.reduce((s,m)=>s+(+m.refacciones||0),0)
  const totalComb   = vComb.reduce((s,c)=>s+(+c.costo||0),0)
  const totalLts    = vComb.reduce((s,c)=>s+(+c.litros||0),0)
  const totalViat   = vViat.reduce((s,v)=>s+(+v.monto||0),0)
  const totalGlobal = totalMtto + totalComb + totalViat

  const eColor={Completado:'success','En proceso':'warning',Pendiente:'info',Cancelado:'danger'}
  const tColor={Preventivo:'info',Correctivo:'warning',Emergencia:'danger'}

  const exportCSV = () => {
    const rows = [
      ['Tipo','Fecha','Descripcion','Costo MO','Costo Ref','Total','Tecnico','Estado'],
      ...vMtto.map(m=>[
        'Mantenimiento', m.fecha, `"${m.descripcion}"`,
        m.mano_obra||0, m.refacciones||0,
        (+m.mano_obra||0)+(+m.refacciones||0),
        m.tecnico||'', m.estado
      ]),
      [],
      ['Tipo','Fecha','Litros','Costo','Combustible','Estacion','Operador'],
      ...vComb.map(c=>[
        'Combustible', c.fecha, c.litros||0, c.costo||0,
        c.tipo_combustible||'', c.estacion||'', c.operador||''
      ]),
      [],
      ['Tipo','Fecha','Tipo Gasto','Monto','Origen','Destino','Operador'],
      ...vViat.map(v=>[
        'Viatico/Caseta', v.fecha, v.tipo||'', v.monto||0,
        v.origen||'', v.destino||'', v.operador||''
      ]),
      [],
      ['RESUMEN'],
      ['Mantenimientos (MO)', totalMO],
      ['Mantenimientos (Refacciones)', totalRef],
      ['Combustible', totalComb],
      ['Viaticos/Casetas', totalViat],
      ['TOTAL GENERAL', totalGlobal],
    ]
    const csv = rows.map(r=>r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `historial_${vehiculo.no_economico}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,overflowY:'auto',padding:'20px 12px'}}>
      <div style={{maxWidth:900,margin:'0 auto',background:'var(--bg2)',borderRadius:14,overflow:'hidden',boxShadow:'0 8px 40px rgba(0,0,0,0.22)'}}>

        {/* Header */}
        <div style={{background:'var(--bg)',padding:'20px 24px',borderBottom:'0.5px solid var(--border)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
            <div>
              <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:6}}>
                <h2 style={{fontSize:20,fontWeight:700,margin:0}}>#{vehiculo.no_economico}</h2>
                <Badge color={vehiculo.activo?'success':'gray'}>{vehiculo.activo?'Activo':'Inactivo'}</Badge>
              </div>
              <p style={{margin:'0 0 2px',fontSize:15,fontWeight:500}}>{vehiculo.nombre||`${vehiculo.marca} ${vehiculo.modelo}`}</p>
              <p style={{margin:0,fontSize:13,color:'var(--text2)'}}>
                {vehiculo.marca} {vehiculo.modelo} {vehiculo.año&&`· ${vehiculo.año}`}
                {vehiculo.campo&&` · ${vehiculo.campo}`}
                {vehiculo.chofer&&` · 👤 ${vehiculo.chofer}`}
              </p>
            </div>
            <div className="no-print" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={()=>window.print()} style={{padding:'8px 16px',borderRadius:8,background:'#378ADD',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer'}}>🖨️ Imprimir</button>
              <button onClick={exportCSV} style={{padding:'8px 16px',borderRadius:8,background:'#1D9E75',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer'}}>📥 Exportar CSV</button>
              <button onClick={onClose} style={{padding:'8px 16px',borderRadius:8,background:'none',border:'0.5px solid var(--border2)',fontSize:13,cursor:'pointer',color:'var(--text2)'}}>✕ Cerrar</button>
            </div>
          </div>

          {/* Totalizador */}
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
            <div style={{background:'#EAF3FB',borderRadius:8,padding:'10px 16px',flex:1,minWidth:120,textAlign:'center'}}>
              <p style={{fontSize:11,color:'#185FA5',margin:'0 0 2px',fontWeight:500}}>Mantenimientos</p>
              <p style={{fontSize:18,fontWeight:700,color:'#185FA5',margin:0}}>${totalMtto.toLocaleString()}</p>
              <p style={{fontSize:10,color:'#378ADD',margin:0}}>{vMtto.length} registros</p>
            </div>
            <div style={{background:'#FAEDE7',borderRadius:8,padding:'10px 16px',flex:1,minWidth:120,textAlign:'center'}}>
              <p style={{fontSize:11,color:'#A03A18',margin:'0 0 2px',fontWeight:500}}>Combustible</p>
              <p style={{fontSize:18,fontWeight:700,color:'#D85A30',margin:0}}>${totalComb.toLocaleString()}</p>
              <p style={{fontSize:10,color:'#D85A30',margin:0}}>{totalLts.toLocaleString()} lts · {vComb.length} cargas</p>
            </div>
            <div style={{background:'#EEEDFE',borderRadius:8,padding:'10px 16px',flex:1,minWidth:120,textAlign:'center'}}>
              <p style={{fontSize:11,color:'#3C3489',margin:'0 0 2px',fontWeight:500}}>Viáticos/Casetas</p>
              <p style={{fontSize:18,fontWeight:700,color:'#534AB7',margin:0}}>${totalViat.toLocaleString()}</p>
              <p style={{fontSize:10,color:'#534AB7',margin:0}}>{vViat.length} registros</p>
            </div>
            <div style={{background:'#E1F5EE',borderRadius:8,padding:'10px 16px',flex:1,minWidth:120,textAlign:'center',border:'1.5px solid #1D9E75'}}>
              <p style={{fontSize:11,color:'#0F6E56',margin:'0 0 2px',fontWeight:600}}>TOTAL GENERAL</p>
              <p style={{fontSize:20,fontWeight:700,color:'#1D9E75',margin:0}}>${totalGlobal.toLocaleString()}</p>
              <p style={{fontSize:10,color:'#1D9E75',margin:0}}>gasto acumulado</p>
            </div>
          </div>

          {/* Sub-totales mantenimiento */}
          {vMtto.length>0&&(
            <div style={{display:'flex',gap:16,marginTop:10,fontSize:12,color:'var(--text2)'}}>
              <span>Mano de obra: <strong style={{color:'#1D9E75'}}>${totalMO.toLocaleString()}</strong></span>
              <span>Refacciones: <strong style={{color:'#D85A30'}}>${totalRef.toLocaleString()}</strong></span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="no-print" style={{background:'var(--bg)',borderBottom:'0.5px solid var(--border)',display:'flex'}}>
          {[
            {id:'mtto',label:`🔧 Mantenimientos (${vMtto.length})`},
            {id:'comb',label:`⛽ Combustible (${vComb.length})`},
            {id:'viat',label:`🛣️ Viáticos (${vViat.length})`},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:'11px 18px',background:'none',border:'none',
              borderBottom:tab===t.id?'2px solid #1D9E75':'2px solid transparent',
              color:tab===t.id?'#0F6E56':'var(--text2)',
              fontWeight:tab===t.id?600:400,fontSize:13,cursor:'pointer'
            }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{padding:'20px 24px'}}>

          {/* MANTENIMIENTOS */}
          {tab==='mtto'&&(
            <div>
              {vMtto.length===0?<EmptyState msg="Sin mantenimientos registrados para este vehículo."/>:(
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {vMtto.map(m=>(
                    <div key={m.id} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:'12px 14px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6,flexWrap:'wrap',gap:6}}>
                        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                          <Badge color={tColor[m.tipo]||'gray'}>{m.tipo}</Badge>
                          <Badge color={eColor[m.estado]||'gray'}>{m.estado}</Badge>
                          <span style={{fontSize:12,color:'var(--text3)'}}>{m.fecha}</span>
                          {m.kilometraje&&<span style={{fontSize:11,color:'var(--text3)'}}>🔢 {Number(m.kilometraje).toLocaleString()} km</span>}
                        </div>
                        <strong style={{color:'#378ADD',fontSize:14}}>${((+m.mano_obra||0)+(+m.refacciones||0)).toLocaleString()}</strong>
                      </div>
                      <p style={{margin:'0 0 4px',fontSize:13,fontWeight:500}}>{m.descripcion}</p>
                      {m.observaciones&&<p style={{margin:'0 0 6px',fontSize:12,color:'var(--text2)'}}>{m.observaciones}</p>}
                      <div style={{display:'flex',gap:14,fontSize:12,color:'var(--text2)',flexWrap:'wrap'}}>
                        {m.tecnico&&<span>🔧 {m.tecnico}</span>}
                        <span>💵 M.O.: <strong style={{color:'#1D9E75'}}>${Number(m.mano_obra||0).toLocaleString()}</strong></span>
                        <span>🔩 Ref.: <strong style={{color:'#D85A30'}}>${Number(m.refacciones||0).toLocaleString()}</strong></span>
                      </div>
                      {m.fotos?.length>0&&(
                        <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                          {m.fotos.map((url,i)=><img key={i} src={url} alt="" style={{width:64,height:50,objectFit:'cover',borderRadius:5,border:'0.5px solid var(--border)'}}/>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* COMBUSTIBLE */}
          {tab==='comb'&&(
            <div>
              {vComb.length===0?<EmptyState msg="Sin registros de combustible."/>:(
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{borderBottom:'0.5px solid var(--border)'}}>
                        {['Fecha','Combustible','Litros','Costo','$/Lt','Kilom.','Estación','Operador'].map(h=>(
                          <th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:500,color:'var(--text2)',fontSize:12,whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vComb.map(c=>(
                        <tr key={c.id} style={{borderBottom:'0.5px solid var(--border)'}}>
                          <td style={{padding:'8px 10px',whiteSpace:'nowrap'}}>{c.fecha}</td>
                          <td style={{padding:'8px 10px'}}>{c.tipo_combustible}</td>
                          <td style={{padding:'8px 10px',fontWeight:600,color:'#D85A30'}}>{c.litros} lts</td>
                          <td style={{padding:'8px 10px',color:'#1D9E75',fontWeight:600}}>{c.costo?`$${Number(c.costo).toLocaleString()}`:'-'}</td>
                          <td style={{padding:'8px 10px',fontSize:11,color:'var(--text3)'}}>{c.costo&&c.litros?`$${(c.costo/c.litros).toFixed(2)}`:'-'}</td>
                          <td style={{padding:'8px 10px',fontSize:11,color:'var(--text2)'}}>{c.kilometraje?Number(c.kilometraje).toLocaleString():'-'}</td>
                          <td style={{padding:'8px 10px',fontSize:12,color:'var(--text2)'}}>{c.estacion||'-'}</td>
                          <td style={{padding:'8px 10px',fontSize:12,color:'var(--text2)'}}>{c.operador||'-'}</td>
                        </tr>
                      ))}
                      <tr style={{borderTop:'1.5px solid var(--border)',background:'var(--bg2)'}}>
                        <td colSpan={2} style={{padding:'8px 10px',fontWeight:600,fontSize:12}}>TOTALES</td>
                        <td style={{padding:'8px 10px',fontWeight:700,color:'#D85A30'}}>{totalLts.toLocaleString()} lts</td>
                        <td style={{padding:'8px 10px',fontWeight:700,color:'#1D9E75'}}>${totalComb.toLocaleString()}</td>
                        <td colSpan={4}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIÁTICOS */}
          {tab==='viat'&&(
            <div>
              {vViat.length===0?<EmptyState msg="Sin registros de viáticos o casetas."/>:(
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{borderBottom:'0.5px solid var(--border)'}}>
                        {['Fecha','Tipo','Monto','Origen','Destino','Operador','Notas'].map(h=>(
                          <th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:500,color:'var(--text2)',fontSize:12}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vViat.map(v=>(
                        <tr key={v.id} style={{borderBottom:'0.5px solid var(--border)'}}>
                          <td style={{padding:'8px 10px',whiteSpace:'nowrap'}}>{v.fecha}</td>
                          <td style={{padding:'8px 10px'}}><Badge color='purple'>{v.tipo}</Badge></td>
                          <td style={{padding:'8px 10px',fontWeight:600,color:'#534AB7'}}>${Number(v.monto).toLocaleString()}</td>
                          <td style={{padding:'8px 10px',fontSize:12,color:'var(--text2)'}}>{v.origen||'-'}</td>
                          <td style={{padding:'8px 10px',fontSize:12,color:'var(--text2)'}}>{v.destino||'-'}</td>
                          <td style={{padding:'8px 10px',fontSize:12,color:'var(--text2)'}}>{v.operador||'-'}</td>
                          <td style={{padding:'8px 10px',fontSize:11,color:'var(--text3)',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.notas||'-'}</td>
                        </tr>
                      ))}
                      <tr style={{borderTop:'1.5px solid var(--border)',background:'var(--bg2)'}}>
                        <td colSpan={2} style={{padding:'8px 10px',fontWeight:600,fontSize:12}}>TOTAL</td>
                        <td style={{padding:'8px 10px',fontWeight:700,color:'#534AB7'}}>${totalViat.toLocaleString()}</td>
                        <td colSpan={4}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Vehículos ── */
function Vehiculos({vehiculos,setVehiculos,mtto,combustible,viaticos,loading}){
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const [filterCampo,setFilterCampo]=useState('Todos')
  const [filterMarca,setFilterMarca]=useState('Todos')
  const [search,setSearch]=useState('')
  const [fichaVeh,setFichaVeh]=useState(null)
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
          {byCampo[campo].map(v=>{
            const vMttoCount=mtto.filter(m=>m.vehiculo_id===v.id).length
            const vCostMtto=mtto.filter(m=>m.vehiculo_id===v.id).reduce((s,m)=>s+(+m.mano_obra||0)+(+m.refacciones||0),0)
            return <div key={v.id}
              onClick={()=>setFichaVeh(v)}
              style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:'12px 14px',opacity:v.activo?1:0.65,cursor:'pointer',transition:'box-shadow 0.15s, border-color 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.10)';e.currentTarget.style.borderColor='#1D9E75'}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor='rgba(0,0,0,0.1)'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontWeight:700,fontSize:15}}>#{v.no_economico}</span>
                <Badge color={v.activo?'success':'gray'}>{v.activo?'Activo':'Inactivo'}</Badge>
              </div>
              <p style={{margin:'0 0 2px',fontSize:12,fontWeight:500,color:'var(--text)'}}>{v.nombre||`${v.marca} ${v.modelo}`}</p>
              <p style={{margin:'0 0 4px',fontSize:11,color:'var(--text2)'}}>{v.marca} {v.modelo} {v.año&&`· ${v.año}`}</p>
              {v.chofer&&<p style={{margin:'0 0 6px',fontSize:11,color:'var(--text3)'}}>👤 {v.chofer}</p>}
              {vMttoCount>0&&(
                <div style={{marginBottom:8,padding:'4px 8px',background:'#EAF3FB',borderRadius:6,fontSize:11,color:'#185FA5'}}>
                  🔧 {vMttoCount} mtto{vMttoCount!==1?'s':''} · <strong>${vCostMtto.toLocaleString()}</strong>
                </div>
              )}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:11,color:'#1D9E75',fontWeight:500}}>Ver historial →</span>
                <button onClick={e=>{e.stopPropagation();toggleActivo(v.id,v.activo)}} style={{fontSize:11,padding:'3px 8px',borderRadius:6,border:'0.5px solid var(--border2)',background:'none',cursor:'pointer',color:'var(--text2)'}}>
                  {v.activo?'Desactivar':'Activar'}
                </button>
              </div>
            </div>
          })}
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
    {fichaVeh&&<FichaVehiculo vehiculo={fichaVeh} mtto={mtto} combustible={combustible} viaticos={viaticos} onClose={()=>setFichaVeh(null)}/>}
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

  const openNew=()=>{setEditId(null);setForm(emptyForm);setFotoPreviews([]);setPendingFiles([]);setShowForm(true)}
  const openEdit=(m)=>{
    setEditId(m.id)
    setForm({fecha:m.fecha,vehiculo_id:m.vehiculo_id,tipo:m.tipo,descripcion:m.descripcion||'',mano_obra:m.mano_obra||'',refacciones:m.refacciones||'',tecnico:m.tecnico||'',estado:m.estado,observaciones:m.observaciones||'',kilometraje:m.kilometraje||''})
    setFotoPreviews(m.fotos||[])
    setPendingFiles([])
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

/* ── QR Code Generator (SVG, no external lib) ── */
function QRSvg({value, size=120}){
  // Simple QR placeholder using identifiable pattern — real QR via Google Charts API
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=1a1a18&margin=4`
  return <img src={url} alt={`QR ${value}`} width={size} height={size} style={{borderRadius:6,display:'block'}}/>
}

/* ── Códigos QR ── */
function QRCodes({vehiculos}){
  const [filterCampo,setFilterCampo]=useState('Todos')
  const BASE_URL = window.location.origin + window.location.pathname

  const rows = vehiculos.filter(v=>filterCampo==='Todos'||v.campo===filterCampo)

  const handlePrint = () => window.print()

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div>
        <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 2px'}}>Códigos QR de vehículos</h2>
        <p style={{fontSize:12,color:'var(--text3)',margin:0}}>Escanea para abrir el registro de combustible preseleccionado</p>
      </div>
      <button onClick={handlePrint} style={{padding:'8px 18px',borderRadius:8,background:'#378ADD',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer'}}>🖨️ Imprimir todos</button>
    </div>
    <div style={{display:'flex',gap:10,marginBottom:16}} className="no-print">
      <select value={filterCampo} onChange={e=>setFilterCampo(e.target.value)} style={{width:'auto',padding:'7px 12px'}}>
        <option>Todos</option>{CAMPOS.map(c=><option key={c}>{c}</option>)}
      </select>
      <span style={{fontSize:12,color:'var(--text3)',alignSelf:'center'}}>{rows.length} vehículos</span>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:16}}>
      {rows.map(v=>{
        const qrUrl = `${BASE_URL}?veh=${v.id}&accion=combustible`
        return <div key={v.id} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:16,textAlign:'center',pageBreakInside:'avoid'}}>
          <QRSvg value={qrUrl} size={140}/>
          <div style={{marginTop:10}}>
            <p style={{fontWeight:700,fontSize:16,margin:'0 0 2px'}}>#{v.no_economico}</p>
            <p style={{fontSize:11,color:'var(--text2)',margin:'0 0 2px'}}>{v.nombre||`${v.marca} ${v.modelo}`}</p>
            <p style={{fontSize:10,color:'var(--text3)',margin:0}}>{v.campo}</p>
          </div>
        </div>
      })}
    </div>
  </div>
}

/* ── Presupuesto mensual de combustible ── */
function Presupuesto({vehiculos,combustible,presupuestos,setPresupuestos,loading}){
  const [saving,setSaving]=useState(false)
  const [mes,setMes]=useState(new Date().toISOString().substring(0,7))
  const [editId,setEditId]=useState(null)
  const [litros,setLitros]=useState('')

  const mesLabel = new Date(mes+'-01').toLocaleDateString('es-MX',{month:'long',year:'numeric'})

  const presupuestoDelMes = presupuestos.filter(p=>p.mes===mes)
  const presMap = Object.fromEntries(presupuestoDelMes.map(p=>[p.vehiculo_id, p]))

  const consumoDelMes = useMemo(()=>{
    const m={}
    combustible.filter(c=>c.fecha?.startsWith(mes)).forEach(c=>{
      m[c.vehiculo_id]=(m[c.vehiculo_id]||0)+(+c.litros||0)
    })
    return m
  },[combustible,mes])

  const savePres = async(vehiculoId) => {
    if(!litros){return}
    setSaving(true)
    const existing = presMap[vehiculoId]
    if(existing){
      const {error}=await supabase.from('presupuesto_combustible').update({litros_asignados:+litros}).eq('id',existing.id)
      if(!error) setPresupuestos(p=>p.map(x=>x.id===existing.id?{...x,litros_asignados:+litros}:x))
    } else {
      const {data,error}=await supabase.from('presupuesto_combustible').insert([{vehiculo_id:Number(vehiculoId),mes,litros_asignados:+litros}]).select()
      if(!error) setPresupuestos(p=>[...p,data[0]])
    }
       setEditId(null); setLitros('')
    setSaving(false)
  }

  const getAlertColor = (consumido, asignado) => {
    if(!asignado) return null
    const pct = consumido/asignado
    if(pct >= 1) return {bar:'#E24B4A', bg:'#FCEBEB', label:'Excedido', badge:'danger'}
    if(pct >= 0.8) return {bar:'#BA7517', bg:'#FAEEDA', label:'Por agotarse', badge:'warning'}
    return {bar:'#1D9E75', bg:'#E1F5EE', label:'Normal', badge:'success'}
  }

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div>
        <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 2px'}}>Presupuesto de combustible</h2>
        <p style={{fontSize:12,color:'var(--text3)',margin:0,textTransform:'capitalize'}}>{mesLabel}</p>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <label style={{fontSize:12,color:'var(--text2)'}}>Mes:</label>
        <input type="month" value={mes} onChange={e=>setMes(e.target.value)} style={{width:'auto',padding:'6px 10px'}}/>
      </div>
    </div>

    {loading?<div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>Cargando...</div>:(
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {vehiculos.map(v=>{
          const pres = presMap[v.id]
          const consumido = consumoDelMes[v.id]||0
          const asignado = pres?.litros_asignados||0
          const pct = asignado>0?Math.min(consumido/asignado,1):0
          const alert = getAlertColor(consumido, asignado)
          const isEditing = editId===v.id

          return <div key={v.id} style={{background:'var(--bg)',border:`0.5px solid ${alert?alert.bar+'40':'var(--border)'}`,borderRadius:10,padding:'12px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <span style={{fontWeight:700,fontSize:14}}>#{v.no_economico}</span>
                <span style={{fontSize:12,color:'var(--text2)'}}>{v.nombre||`${v.marca} ${v.modelo}`}</span>
                <Badge color="gray">{v.campo}</Badge>
                {alert&&<Badge color={alert.badge}>{alert.label}</Badge>}
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontSize:13,color:'var(--text2)'}}>
                  <strong style={{color:alert?.bar||'var(--text)'}}>{consumido.toFixed(0)}</strong>
                  {asignado>0&&<> / {asignado} lts</>}
                </span>
                {isEditing?(
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <input type="number" value={litros} onChange={e=>setLitros(e.target.value)}
                      placeholder="Lts asignados" style={{width:130,padding:'4px 8px',fontSize:12}}
                      autoFocus onKeyDown={e=>{if(e.key==='Enter')savePres(v.id)}}/>
                    <Btn small color="#1D9E75" onClick={()=>savePres(v.id)} disabled={saving}>Guardar</Btn>
                    <Btn small outline color="#888" onClick={()=>{setEditId(null);setLitros('')}}>✕</Btn>
                  </div>
                ):(
                  <button onClick={()=>{setEditId(v.id);setLitros(asignado||'')}} style={{fontSize:11,padding:'3px 10px',borderRadius:6,border:'0.5px solid var(--border2)',background:'none',cursor:'pointer',color:'var(--text2)'}}>
                    {asignado?'✏️ Editar':'+ Asignar litros'}
                  </button>
                )}
              </div>
            </div>
            {asignado>0&&(
              <div style={{marginTop:10}}>
                <div style={{height:8,borderRadius:4,background:'var(--bg2)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct*100}%`,background:alert?.bar||'#1D9E75',borderRadius:4,transition:'width 0.4s'}}/>
                </div>
                <p style={{fontSize:10,color:'var(--text3)',margin:'3px 0 0',textAlign:'right'}}>
                  {(pct*100).toFixed(0)}% consumido · {Math.max(0,asignado-consumido).toFixed(0)} lts disponibles
                </p>
              </div>
            )}
          </div>
        })}
      </div>
    )}
  </div>
}

/* ── Reporte de combustible ── */
function ReporteCombustible({combustible,vehiculos}){
  const [filterVeh,setFilterVeh]=useState('Todos')
  const [filterCampo,setFilterCampo]=useState('Todos')
  const [filterDesde,setFilterDesde]=useState('')
  const [filterHasta,setFilterHasta]=useState('')

  const vehMap = Object.fromEntries(vehiculos.map(v=>[v.id,v]))

  const rows = useMemo(()=>combustible.filter(c=>{
    const veh=vehMap[c.vehiculo_id]
    if(filterVeh!=='Todos'&&String(c.vehiculo_id)!==filterVeh) return false
    if(filterCampo!=='Todos'&&veh?.campo!==filterCampo) return false
    if(filterDesde&&c.fecha<filterDesde) return false
    if(filterHasta&&c.fecha>filterHasta) return false
    return true
  }),[combustible,filterVeh,filterCampo,filterDesde,filterHasta,vehMap])

  // Rendimiento por unidad (km/litro)
  const rendimiento = useMemo(()=>{
    const m={}
    rows.forEach(c=>{
      const id=c.vehiculo_id
      if(!m[id]) m[id]={litros:0,km_inicial:null,km_final:null,cargas:0,costo:0}
      m[id].litros+=(+c.litros||0)
      m[id].costo+=(+c.costo||0)
      m[id].cargas++
      const km=+c.kilometraje||0
      if(km>0){
        if(m[id].km_inicial===null||km<m[id].km_inicial) m[id].km_inicial=km
        if(m[id].km_final===null||km>m[id].km_final) m[id].km_final=km
      }
    })
    return Object.entries(m).map(([id,d])=>{
      const veh=vehMap[id]
      const km_recorridos=d.km_final&&d.km_inicial?d.km_final-d.km_inicial:0
      const rendKmLt=km_recorridos>0&&d.litros>0?(km_recorridos/d.litros).toFixed(2):'-'
      return {
        id, no_eco:veh?.no_economico||'?',
        nombre:veh?.nombre||`${veh?.marca||''} ${veh?.modelo||''}`,
        campo:veh?.campo||'-',
        litros:+d.litros.toFixed(1), costo:d.costo,
        cargas:d.cargas, km_recorridos, rendKmLt
      }
    }).sort((a,b)=>b.litros-a.litros)
  },[rows,vehMap])

  const totalLts=rows.reduce((s,c)=>s+(+c.litros||0),0)
  const totalCosto=rows.reduce((s,c)=>s+(+c.costo||0),0)

  const exportCSV=()=>{
    const header=['Fecha','No. Eco','Vehículo','Campo','Combustible','Litros','Costo','Km','Estación','Operador']
    const data=rows.map(c=>{
      const veh=vehMap[c.vehiculo_id]
      return [c.fecha,`#${veh?.no_economico||'?'}`,`"${veh?.nombre||''}"`,veh?.campo||'',c.tipo_combustible||'',c.litros||0,c.costo||0,c.kilometraje||'',`"${c.estacion||''}"`,`"${c.operador||''}"`]
    })
    const csv=[[...header],...data,[''],['TOTALES','','','','',totalLts.toFixed(1),totalCosto]].map(r=>r.join(',')).join('\n')
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a'); a.href=url; a.download=`reporte_combustible_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div>
        <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 2px'}}>Reporte de combustible</h2>
        <p style={{fontSize:12,color:'var(--text3)',margin:0}}>{rows.length} registros · {totalLts.toFixed(0)} lts · ${totalCosto.toLocaleString()}</p>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={()=>window.print()} style={{padding:'7px 14px',borderRadius:8,background:'#378ADD',color:'#fff',border:'none',fontSize:12,cursor:'pointer',fontWeight:500}}>🖨️ Imprimir</button>
        <button onClick={exportCSV} style={{padding:'7px 14px',borderRadius:8,background:'#1D9E75',color:'#fff',border:'none',fontSize:12,cursor:'pointer',fontWeight:500}}>📥 Exportar CSV</button>
      </div>
    </div>

    {/* Filtros */}
    <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',background:'var(--bg)',padding:'12px 14px',borderRadius:10,border:'0.5px solid var(--border)'}}>
      <div style={{display:'flex',flexDirection:'column',gap:3}}>
        <label style={{fontSize:11,color:'var(--text3)'}}>Vehículo</label>
        <select value={filterVeh} onChange={e=>setFilterVeh(e.target.value)} style={{width:'auto',padding:'6px 10px',fontSize:12}}>
          <option value="Todos">Todos</option>
          {vehiculos.map(v=><option key={v.id} value={String(v.id)}>#{v.no_economico} {v.nombre||v.marca}</option>)}
        </select>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:3}}>
        <label style={{fontSize:11,color:'var(--text3)'}}>Campo</label>
        <select value={filterCampo} onChange={e=>setFilterCampo(e.target.value)} style={{width:'auto',padding:'6px 10px',fontSize:12}}>
          <option>Todos</option>{CAMPOS.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:3}}>
        <label style={{fontSize:11,color:'var(--text3)'}}>Desde</label>
        <input type="date" value={filterDesde} onChange={e=>setFilterDesde(e.target.value)} style={{width:'auto',padding:'6px 10px',fontSize:12}}/>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:3}}>
        <label style={{fontSize:11,color:'var(--text3)'}}>Hasta</label>
        <input type="date" value={filterHasta} onChange={e=>setFilterHasta(e.target.value)} style={{width:'auto',padding:'6px 10px',fontSize:12}}/>
      </div>
      {(filterVeh!=='Todos'||filterCampo!=='Todos'||filterDesde||filterHasta)&&(
        <button onClick={()=>{setFilterVeh('Todos');setFilterCampo('Todos');setFilterDesde('');setFilterHasta('')}}
          style={{alignSelf:'flex-end',padding:'6px 12px',borderRadius:6,border:'0.5px solid var(--border2)',background:'none',fontSize:12,cursor:'pointer',color:'var(--text2)'}}>
          ✕ Limpiar filtros
        </button>
      )}
    </div>

    {/* Resumen de rendimiento por unidad */}
    {rendimiento.length>0&&(
      <div style={{marginBottom:20}}>
        <p style={{fontSize:13,fontWeight:600,margin:'0 0 10px'}}>Rendimiento por unidad (km/lt)</p>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{borderBottom:'0.5px solid var(--border)',background:'var(--bg2)'}}>
                {['No. Eco','Vehículo','Campo','Cargas','Litros','Costo','Km recorridos','Rendimiento km/lt'].map(h=>(
                  <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:500,color:'var(--text2)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rendimiento.map(r=>(
                <tr key={r.id} style={{borderBottom:'0.5px solid var(--border)'}}>
                  <td style={{padding:'7px 10px',fontWeight:700}}>#{r.no_eco}</td>
                  <td style={{padding:'7px 10px',fontSize:11,color:'var(--text2)'}}>{r.nombre}</td>
                  <td style={{padding:'7px 10px'}}><Badge color="gray">{r.campo?.split(' ')[0]}</Badge></td>
                  <td style={{padding:'7px 10px',textAlign:'center'}}>{r.cargas}</td>
                  <td style={{padding:'7px 10px',fontWeight:600,color:'#D85A30'}}>{r.litros} lts</td>
                  <td style={{padding:'7px 10px',color:'#1D9E75'}}>${r.costo.toLocaleString()}</td>
                  <td style={{padding:'7px 10px',color:'var(--text2)'}}>{r.km_recorridos>0?`${r.km_recorridos.toLocaleString()} km`:'-'}</td>
                  <td style={{padding:'7px 10px'}}>
                    {r.rendKmLt!=='-'?(
                      <span style={{fontWeight:700,color:+r.rendKmLt>=10?'#1D9E75':+r.rendKmLt>=7?'#BA7517':'#E24B4A'}}>
                        {r.rendKmLt} km/lt
                      </span>
                    ):'-'}
                  </td>
                </tr>
              ))}
              <tr style={{borderTop:'1.5px solid var(--border)',background:'var(--bg2)'}}>
                <td colSpan={4} style={{padding:'7px 10px',fontWeight:600,fontSize:12}}>TOTALES</td>
                <td style={{padding:'7px 10px',fontWeight:700,color:'#D85A30'}}>{totalLts.toFixed(0)} lts</td>
                <td style={{padding:'7px 10px',fontWeight:700,color:'#1D9E75'}}>${totalCosto.toLocaleString()}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )}

    {/* Detalle de registros */}
    <p style={{fontSize:13,fontWeight:600,margin:'0 0 10px'}}>Detalle de cargas</p>
    {rows.length===0?<div style={{textAlign:'center',padding:'30px 20px',color:'var(--text3)',fontSize:13}}>⛽ Sin registros con los filtros seleccionados.</div>:(
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead>
            <tr style={{borderBottom:'0.5px solid var(--border)',background:'var(--bg2)'}}>
              {['Fecha','No. Eco','Campo','Combustible','Litros','Costo','$/lt','Kilometraje','Estación','Operador'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:500,color:'var(--text2)',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(c=>{
              const veh=vehMap[c.vehiculo_id]
              const pxl=c.litros>0&&c.costo>0?(c.costo/c.litros).toFixed(2):'-'
              return <tr key={c.id} style={{borderBottom:'0.5px solid var(--border)'}}>
                <td style={{padding:'7px 10px',whiteSpace:'nowrap'}}>{c.fecha}</td>
                <td style={{padding:'7px 10px',fontWeight:600}}>#{veh?.no_economico||'?'}</td>
                <td style={{padding:'7px 10px'}}><Badge color="gray">{veh?.campo?.split(' ')[0]||'-'}</Badge></td>
                <td style={{padding:'7px 10px'}}>{c.tipo_combustible}</td>
                <td style={{padding:'7px 10px',fontWeight:600,color:'#D85A30'}}>{c.litros} lts</td>
                <td style={{padding:'7px 10px',color:'#1D9E75'}}>{c.costo?`$${Number(c.costo).toLocaleString()}`:'-'}</td>
                <td style={{padding:'7px 10px',color:'var(--text3)'}}>{pxl!=='-'?`$${pxl}`:'-'}</td>
                <td style={{padding:'7px 10px',color:'var(--text2)'}}>{c.kilometraje?Number(c.kilometraje).toLocaleString()+' km':'-'}</td>
                <td style={{padding:'7px 10px',color:'var(--text2)'}}>{c.estacion||'-'}</td>
                <td style={{padding:'7px 10px',color:'var(--text2)'}}>{c.operador||'-'}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
}

/* ── Combustible ── */
function Combustible({combustible,setCombustible,vehiculos,loading}){
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const emptyForm={fecha:new Date().toISOString().split('T')[0],vehiculo_id:'',litros:'',costo:'',kilometraje:'',tipo_combustible:'Gasolina',estacion:'',operador:''}
  const [form,setForm]=useState(emptyForm)

  // Auto-open form with vehicle preselected when coming from QR scan
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search)
    const vehId=params.get('veh')
    if(vehId&&vehiculos.length>0){
      const veh=vehiculos.find(v=>String(v.id)===vehId)
      if(veh){
        setForm(f=>({...f,vehiculo_id:veh.id}))
        setShowForm(true)
        // Clean URL so refresh doesn't reopen
        window.history.replaceState({},'',window.location.pathname)
      }
    }
  },[vehiculos])

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
  const [presupuestos,setPresupuestos]=useState([])
  const [loading,setLoading]=useState(true)
  const [dbError,setDbError]=useState(null)

  // Handle QR scan: ?veh=ID&accion=combustible
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search)
    const vehId=params.get('veh')
    const accion=params.get('accion')
    if(vehId&&accion==='combustible') setPage('combustible')
  },[])

  const loadAll=useCallback(async()=>{
    setLoading(true)
    try{
      const [v,m,c,vi,p]=await Promise.all([
        supabase.from('vehiculos').select('*').order('no_economico'),
        supabase.from('mtto_vehiculos').select('*').order('fecha',{ascending:false}),
        supabase.from('combustible_vehiculos').select('*').order('fecha',{ascending:false}),
        supabase.from('viaticos_vehiculos').select('*').order('fecha',{ascending:false}),
        supabase.from('presupuesto_combustible').select('*'),
      ])
      if(v.error||m.error||c.error||vi.error){setDbError('No se pudieron cargar los datos. Verifica que las tablas existan en Supabase.')}
      else{setVehiculos(v.data||[]);setMtto(m.data||[]);setCombustible(c.data||[]);setViaticos(vi.data||[]);setPresupuestos(p.data||[])}
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
      {page==='vehiculos'&&<Vehiculos vehiculos={vehiculos} setVehiculos={setVehiculos} mtto={mtto} combustible={combustible} viaticos={viaticos} loading={loading}/>}
      {page==='mtto'&&<Mantenimientos mtto={mtto} setMtto={setMtto} vehiculos={vehiculos} loading={loading}/>}
      {page==='combustible'&&<Combustible combustible={combustible} setCombustible={setCombustible} vehiculos={vehiculos} loading={loading}/>}
      {page==='presupuesto'&&<Presupuesto vehiculos={vehiculos} combustible={combustible} presupuestos={presupuestos} setPresupuestos={setPresupuestos} loading={loading}/>}
      {page==='reporte'&&<ReporteCombustible combustible={combustible} vehiculos={vehiculos}/>}
      {page==='qrcodes'&&<QRCodes vehiculos={vehiculos}/>}
      {page==='viaticos'&&<Viaticos viaticos={viaticos} setViaticos={setViaticos} vehiculos={vehiculos} loading={loading}/>}
      {page==='analisis'&&<Analisis vehiculos={vehiculos} mtto={mtto} combustible={combustible} viaticos={viaticos}/>}
    </div>
  </div>
}
