// Independent, non-SQL oracles for the playlist. They also evaluate custom inputs.
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const sum = (rows, value = x=>x) => rows.reduce((n,r)=>n+value(r),0);
const group = (rows, key) => {
  const out=new Map();
  for(const row of rows){const k=key(row);if(!out.has(k))out.set(k,[]);out.get(k).push(row);}
  return [...out];
};
const unique = rows => [...new Map(rows.map(r=>[JSON.stringify(r),r])).values()];
const day = value => Date.parse(value.slice(0,10)+'T00:00:00Z')/86400000;
const seconds = value => Date.parse(value.replace(' ','T')+'Z')/1000;
const round = (n,d=2) => Math.round((n+Number.EPSILON)*10**d)/10**d;
const sorted = (rows,index=0) => [...rows].sort((a,b)=>cmp(a[index],b[index]));
const hire = rows => {
  let budget=70000;
  return ['Senior','Junior'].map(type=>{
    const hired=[];
    for(const r of rows.filter(r=>r[1]===type).sort((a,b)=>a[2]-b[2]||a[0]-b[0])){
      if(r[2]>budget)break;budget-=r[2];hired.push(r[0]);
    }
    return [type,hired];
  });
};
const friendship = rows => unique(rows.flatMap(([a,b])=>[[a,b],[b,a]]));
const similar = ({Listens}) => {
  const pairs=[];
  for(const [,daily] of group(Listens,r=>r[2])){
    const users=group(daily,r=>r[0]).map(([id,rows])=>[id,new Set(rows.map(r=>r[1]))]);
    for(const [a,songs] of users)for(const [b,other] of users)
      if(a<b&&[...songs].filter(s=>other.has(s)).length>=3)pairs.push([a,b]);
  }
  return unique(pairs);
};
const months = ({Drivers,Rides,AcceptedRides}) => Array.from({length:12},(_,i)=>{
  const prefix=`2020-${String(i+1).padStart(2,'0')}`;
  const ids=new Set(Rides.filter(r=>r[2].startsWith(prefix)).map(r=>r[0]));
  const rides=AcceptedRides.filter(r=>ids.has(r[0]));
  return {month:i+1,drivers:Drivers.filter(r=>r[1].slice(0,7)<=prefix).length,rides};
});
const hierarchy = rows => {
  const root=rows.find(r=>r[2]===null), levels=new Map(root?[[root[0],1]]:[]);
  for(let i=0;i<rows.length;i++)for(const r of rows)if(levels.has(r[2]))levels.set(r[0],levels.get(r[2])+1);
  return {root,levels};
};

// Each function returns rows in the requested output-column order.
export const playlistRows = {
  1369: ({UserActivity}) => group(UserActivity,r=>r[0]).map(([,rows])=>sorted(rows,2).at(rows.length===1?0:-2)),
  1479: ({Orders,Items}) => group(Items,r=>r[2]).sort(([a],[b])=>cmp(a,b)).map(([category,items])=>{
    const ids=new Set(items.map(r=>r[0])), totals=Array(7).fill(0);
    for(const r of Orders)if(ids.has(r[3]))totals[(new Date(r[2]+'T00:00:00Z').getUTCDay()+6)%7]+=r[4];
    return [category,...totals];
  }),
  569: ({Employee}) => group(Employee,r=>r[1]).flatMap(([,rows])=>{
    const values=[...rows].sort((a,b)=>a[2]-b[2]||a[0]-b[0]);
    return values.slice(Math.floor((values.length-1)/2),Math.floor(values.length/2)+1);
  }),
  615: ({Salary,Employee}) => {
    const departments=new Map(Employee);
    return group(Salary,r=>r[3].slice(0,7)).flatMap(([month,rows])=>{
      const average=sum(rows,r=>r[2])/rows.length;
      return group(rows,r=>departments.get(r[1])).map(([id,items])=>{
        const local=sum(items,r=>r[2])/items.length;
        return [month,id,local>average?'higher':local<average?'lower':'same'];
      });
    });
  },
  2004: ({Candidates}) => hire(Candidates).map(([type,ids])=>[type,ids.length]),
  2010: ({Candidates}) => hire(Candidates).flatMap(([,ids])=>ids.map(id=>[id])),
  2199: ({Keywords,Posts}) => Posts.map(([id,text])=>{
    const words=new Set(text.toLowerCase().split(' '));
    const topics=[...new Set(Keywords.filter(r=>words.has(r[1].toLowerCase())).map(r=>r[0]))].sort((a,b)=>a-b);
    return [id,topics.length?topics.join(','):'Ambiguous!'];
  }),
  1412: ({Student,Exam}) => {
    const seen=new Set(),excluded=new Set();
    for(const [,rows] of group(Exam,r=>r[0])){
      const scores=rows.map(r=>r[2]),low=Math.min(...scores),high=Math.max(...scores);
      for(const r of rows){seen.add(r[1]);if(r[2]===low||r[2]===high)excluded.add(r[1]);}
    }
    return sorted(Student.filter(r=>seen.has(r[0])&&!excluded.has(r[0])));
  },
  2362: ({Products,Purchases}) => {
    const prices=new Map(Products),invoices=group(Purchases,r=>r[0]);
    invoices.sort(([a,x],[b,y])=>sum(y,r=>prices.get(r[1])*r[2])-sum(x,r=>prices.get(r[1])*r[2])||a-b);
    return (invoices[0]?.[1]||[]).map(r=>[r[1],r[2],r[2]*prices.get(r[1])]);
  },
  1767: ({Tasks,Executed}) => Tasks.flatMap(([id,count])=>Array.from({length:count},(_,i)=>[id,i+1]).filter(([a,b])=>!Executed.some(r=>r[0]===a&&r[1]===b))),
  1225: ({Failed,Succeeded}) => {
    const days=sorted([...Failed.map(([d])=>[d,'failed']),...Succeeded.map(([d])=>[d,'succeeded'])].filter(r=>r[0]>='2019-01-01'&&r[0]<='2019-12-31'));
    const out=[];
    for(const [date,state] of days){const last=out.at(-1);if(last&&last[0]===state&&day(date)-day(last[2])===1)last[2]=date;else out.push([state,date,date]);}
    return out;
  },
  3057: ({Project,Employees}) => {
    const employees=new Map(Employees.map(r=>[r[0],r]));
    return group(Project,r=>employees.get(r[1])[2]).flatMap(([,rows])=>rows.filter(r=>r[2]>sum(rows,r=>r[2])/rows.length).map(r=>[r[1],r[0],employees.get(r[1])[1],r[2]])).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  },
  2793: ({Flights,Passengers}) => {
    const capacity=new Map(Flights);
    return sorted(group(Passengers,r=>r[1]).flatMap(([id,rows])=>sorted(rows,2).map((r,i)=>[r[0],i<capacity.get(id)?'Confirmed':'Waitlist'])));
  },
  1159: ({Users,Orders,Items}) => {
    const brands=new Map(Items);
    return Users.map(([id,,favorite])=>[id,brands.get(sorted(Orders.filter(r=>r[4]===id),1)[1]?.[2])===favorite?'yes':'no']);
  },
  1194: ({Players,Matches}) => {
    const scores=new Map(Players.map(r=>[r[0],0]));
    for(const [,a,b,x,y] of Matches){scores.set(a,scores.get(a)+x);scores.set(b,scores.get(b)+y);}
    return group(Players,r=>r[1]).map(([id,rows])=>[id,[...rows].sort((a,b)=>scores.get(b[0])-scores.get(a[0])||a[0]-b[0])[0][0]]);
  },
  1972: ({Calls}) => unique(group(Calls.flatMap(([a,b,t])=>[[a,b,t],[b,a,t]]),r=>JSON.stringify([r[0],r[2].slice(0,10)])).filter(([,rows])=>sorted(rows,2)[0][1]===sorted(rows,2).at(-1)[1]).map(([,rows])=>[rows[0][0]])),
  2173: ({Matches}) => group(Matches,r=>r[0]).map(([id,rows])=>{
    let best=0,current=0;for(const r of sorted(rows,1)){current=r[2]==='Win'?current+1:0;best=Math.max(best,current);}return [id,best];
  }),
  2474: ({Orders}) => group(Orders,r=>r[1]).filter(([,rows])=>{
    const years=group(rows,r=>Number(r[2].slice(0,4))).sort(([a],[b])=>a-b).map(([year,items])=>[year,sum(items,r=>r[3])]);
    return years.every((r,i)=>!i||(r[0]===years[i-1][0]+1&&r[1]>years[i-1][1]));
  }).map(([id])=>[id]),
  3214: ({user_transactions}) => group(user_transactions,r=>r[1]).sort(([a],[b])=>a-b).flatMap(([id,rows])=>{
    const years=new Map(group(rows,r=>Number(r[3].slice(0,4))).map(([y,rs])=>[y,round(sum(rs,r=>r[2]))]));
    return [...years].sort(([a],[b])=>a-b).map(([year,current])=>{
      const previous=years.get(year-1)??null;
      return [year,id,current,previous,previous?round((current-previous)/previous*100):null];
    });
  }),
  3052: ({Inventory}) => {
    const prime=Inventory.filter(r=>r[1]==='prime_eligible'),other=Inventory.filter(r=>r[1]==='not_prime');
    const area=sum(prime,r=>r[3]),remaining=sum(other,r=>r[3]),batches=area?Math.floor(500000/area):0;
    return [['prime_eligible',batches*prime.length],['not_prime',remaining?Math.floor((500000-batches*area)/remaining)*other.length:0]].sort((a,b)=>b[1]-a[1]);
  },
  2991: ({Wineries}) => group(Wineries,r=>r[1]).sort(([a],[b])=>cmp(a,b)).map(([country,rows])=>{
    const ranked=group(rows,r=>r[3]).map(([name,items])=>[name,sum(items,r=>r[2])]).sort((a,b)=>b[1]-a[1]||cmp(a[0],b[0])).map(([name,points])=>`${name} (${points})`);
    return [country,ranked[0],ranked[1]||'No second winery',ranked[2]||'No third winery'];
  }),
  262: ({Trips,Users}) => {
    const allowed=new Set(Users.filter(r=>r[1]==='No').map(r=>r[0]));
    return group(Trips.filter(r=>allowed.has(r[1])&&allowed.has(r[2])&&r[5]>='2013-10-01'&&r[5]<='2013-10-03'),r=>r[5]).map(([date,rows])=>[date,round(rows.filter(r=>r[4]!=='completed').length/rows.length)]);
  },
  579: ({Employee}) => group(Employee,r=>r[0]).sort(([a],[b])=>a-b).flatMap(([id,rows])=>sorted(rows,1).slice(0,-1).reverse().map(([,month])=>[id,month,sum(rows.filter(r=>r[1]>=month-2&&r[1]<=month),r=>r[2])])),
  601: ({Stadium}) => {
    const blocks=[];
    for(const r of sorted(Stadium).filter(r=>r[2]>=100)){if(blocks.at(-1)?.at(-1)[0]===r[0]-1)blocks.at(-1).push(r);else blocks.push([r]);}
    return blocks.filter(r=>r.length>=3).flat();
  },
  1097: ({Activity}) => group(group(Activity,r=>r[0]).map(([id,rows])=>{const dates=rows.map(r=>r[2]).sort();return [id,dates[0],dates.some(d=>day(d)-day(dates[0])===1)];}),r=>r[1]).map(([date,rows])=>[date,rows.length,round(rows.filter(r=>r[2]).length/rows.length)]),
  1892: ({Friendship,Likes}) => group(friendship(Friendship),r=>r[0]).flatMap(([id,rows])=>{
    const friends=new Set(rows.map(r=>r[1])),own=new Set(Likes.filter(r=>r[0]===id).map(r=>r[1]));
    return group(Likes.filter(r=>friends.has(r[0])&&!own.has(r[1])),r=>r[1]).map(([page,items])=>[id,page,items.length]);
  }),
  1919: input => similar(input).filter(([a,b])=>input.Friendship.some(r=>r[0]===a&&r[1]===b)),
  1917: input => similar(input).filter(([a,b])=>!input.Friendship.some(r=>r[0]===a&&r[1]===b)).flatMap(([a,b])=>[[a,b],[b,a]]),
  2720: ({Friends}) => {const pairs=friendship(Friends),users=group(pairs,r=>r[0]);return users.sort(([a],[b])=>a-b).map(([id,rows])=>[id,round(rows.length/users.length*100)]);},
  2752: ({Transactions}) => {
    const streaks=group(Transactions,r=>r[1]).map(([id,rows])=>{let n=0,best=0,last;for(const r of sorted(rows,2)){n=last!==undefined&&day(r[2])-last===1?n+1:1;last=day(r[2]);best=Math.max(n,best);}return [id,best];});
    const maximum=Math.max(...streaks.map(r=>r[1]));return sorted(streaks.filter(r=>r[1]===maximum).map(r=>[r[0]]));
  },
  2995: ({Sessions}) => group(Sessions,r=>r[0]).filter(([,rows])=>sorted(rows,1)[0][4]==='Viewer').map(([id,rows])=>[id,rows.filter(r=>r[4]==='Streamer').length]).filter(r=>r[1]>0).sort((a,b)=>b[1]-a[1]||b[0]-a[0]),
  3236: ({Employees}) => {const {root,levels}=hierarchy(Employees);return Employees.filter(r=>levels.get(r[0])>1).map(r=>[r[0],r[1],levels.get(r[0])-1,r[3]-root[3]]).sort((a,b)=>a[2]-b[2]||a[0]-b[0]);},
  3188: ({students,courses,enrollments}) => sorted(students.filter(([id,,major])=>{
    const rows=enrollments.filter(r=>r[0]===id),required=courses.filter(r=>r[3]===major&&r[4].toLowerCase()==='yes'),elective=courses.filter(r=>r[3]===major&&r[4].toLowerCase()==='no');
    if(!rows.length||sum(rows,r=>r[4])/rows.length<2.5)return false;
    if(!required.every(c=>rows.some(r=>r[1]===c[0])&&rows.filter(r=>r[1]===c[0]).every(r=>r[3]==='A')))return false;
    const taken=elective.filter(c=>rows.some(r=>r[1]===c[0]));
    return taken.length>=2&&taken.every(c=>rows.filter(r=>r[1]===c[0]).every(r=>['A','B'].includes(r[3])));
  }).map(r=>[r[0]])),
  571: ({Numbers}) => {
    const total=sum(Numbers,r=>r[1]),positions=[Math.floor((total+1)/2),Math.floor((total+2)/2)];let count=0;const values=[];
    for(const [num,frequency] of sorted(Numbers)){for(const p of positions)if(p>count&&p<=count+frequency)values.push(num);count+=frequency;}
    return [[values.length?round(sum(values)/values.length,1):null]];
  },
  1127: ({Spending}) => group(Spending,r=>r[1]).flatMap(([date,rows])=>{
    const users=group(rows,r=>r[0]).map(([,rs])=>[rs.length>1?'both':rs[0][2],sum(rs,r=>r[3])]);
    return ['desktop','mobile','both'].map(p=>{const selected=users.filter(r=>r[0]===p);return [date,p,sum(selected,r=>r[1]),selected.length];});
  }),
  1336: ({Visits,Transactions}) => {const counts=Visits.map(([u,d])=>Transactions.filter(r=>r[0]===u&&r[1]===d).length);return Array.from({length:Math.max(0,...counts)+1},(_,n)=>[n,counts.filter(c=>c===n).length]);},
  1635: input => months(input).map(m=>[m.month,m.drivers,m.rides.length]),
  1645: input => months(input).map(m=>[m.month,m.drivers?round(new Set(m.rides.map(r=>r[1])).size/m.drivers*100):0]),
  1651: input => {const monthly=months(input);return monthly.slice(0,10).map((m,i)=>[m.month,round(sum(monthly.slice(i,i+3),m=>sum(m.rides,r=>r[2]))/3),round(sum(monthly.slice(i,i+3),m=>sum(m.rides,r=>r[3]))/3)]);},
  3384: ({Teams,Passes}) => {const teams=new Map(Teams);return group(Passes.map(([from,time,to])=>[teams.get(from),time<='45:00'?1:2,teams.get(from)===teams.get(to)?1:-1]),r=>JSON.stringify(r.slice(0,2))).map(([,rows])=>[...rows[0].slice(0,2),sum(rows,r=>r[2])]).sort((a,b)=>cmp(a[0],b[0])||a[1]-b[1]);},
  3268: ({EmployeeShifts}) => group(EmployeeShifts,r=>r[0]).sort(([a],[b])=>a-b).map(([id,rows])=>{
    let overlap=0,maximum=1;
    for(let i=0;i<rows.length;i++){
      maximum=Math.max(maximum,rows.filter(r=>r[1]<=rows[i][1]&&r[2]>rows[i][1]&&r[1].slice(0,10)===rows[i][1].slice(0,10)).length);
      for(let j=i+1;j<rows.length;j++)if(rows[i][1].slice(0,10)===rows[j][1].slice(0,10))overlap+=Math.max(0,Math.floor((Math.min(seconds(rows[i][2]),seconds(rows[j][2]))-Math.max(seconds(rows[i][1]),seconds(rows[j][1])))/60));
    }
    return [id,maximum,overlap];
  }),
  618: ({Student}) => {const lists=['America','Asia','Europe'].map(c=>Student.filter(r=>r[1]===c).map(r=>r[0]).sort());return Array.from({length:Math.max(0,...lists.map(r=>r.length))},(_,i)=>lists.map(r=>r[i]??null));},
  3673: ({app_events}) => group(app_events,r=>r[4]).flatMap(([id,rows])=>{
    const duration=Math.max(...rows.map(r=>seconds(r[2])))-Math.min(...rows.map(r=>seconds(r[2]))),scrolls=rows.filter(r=>r[3]==='scroll').length,clicks=rows.filter(r=>r[3]==='click').length;
    return duration>1800&&scrolls>=5&&clicks/scrolls<0.2&&!rows.some(r=>r[3]==='purchase')?[[id,rows[0][1],Math.floor(duration/60),scrolls]]:[];
  }).sort((a,b)=>b[3]-a[3]||cmp(a[0],b[0])),
  3554: ({ProductPurchases,ProductInfo}) => {
    const categories=new Map(ProductInfo.map(r=>[r[0],r[1]])),pairs=[];
    for(const [,rows] of group(ProductPurchases,r=>r[0])){const cs=[...new Set(rows.map(r=>categories.get(r[1])))].sort();for(let i=0;i<cs.length;i++)for(let j=i+1;j<cs.length;j++)pairs.push([cs[i],cs[j]]);}
    return group(pairs,r=>JSON.stringify(r)).map(([,rows])=>[...rows[0],rows.length]).filter(r=>r[2]>=3).sort((a,b)=>b[2]-a[2]||cmp(a[0],b[0])||cmp(a[1],b[1]));
  },
  2994: ({Purchases}) => [3,10,17,24].map((d,i)=>{const date=`2023-11-${String(d).padStart(2,'0')}`;return [i+1,date,sum(Purchases.filter(r=>r[1]===date),r=>r[2])];}),
  2494: ({HallEvents}) => group(HallEvents,r=>r[0]).flatMap(([,rows])=>{
    const merged=[];for(const r of sorted(rows,1)){const last=merged.at(-1);if(last&&last[2]>=r[1])last[2]=last[2]>r[2]?last[2]:r[2];else merged.push([...r]);}return merged;
  }),
  3060: ({Sessions}) => sorted([...new Set(Sessions.filter(a=>Sessions.some(b=>a[0]===b[0]&&a[4]===b[4]&&a[3]!==b[3]&&seconds(b[1])-seconds(a[2])>=0&&seconds(b[1])-seconds(a[2])<=43200)).map(r=>r[0]))].map(id=>[id])),
  3764: ({course_completions}) => {
    const pairs=group(course_completions,r=>r[0]).filter(([,rows])=>rows.length>=5&&sum(rows,r=>r[4])/rows.length>=4).flatMap(([,rows])=>{const ordered=sorted(rows,3);return ordered.slice(1).map((r,i)=>[ordered[i][2],r[2]]);});
    return group(pairs,r=>JSON.stringify(r)).map(([,rows])=>[...rows[0],rows.length]).sort((a,b)=>b[2]-a[2]||cmp(a[0],b[0])||cmp(a[1],b[1]));
  },
  3832: ({activity}) => group(activity,r=>r[0]).flatMap(([id,rows])=>{
    const streaks=[];let current;
    for(const [date,events] of group(sorted(rows,1),r=>r[1])){
      if(events.length!==1){current=null;continue;}
      if(current&&current[1]===events[0][2]&&day(date)-day(current[4])===1){current[2]++;current[4]=date;}
      else {current=[id,events[0][2],1,date,date];streaks.push(current);}
    }
    const best=streaks.filter(r=>r[2]>=5).sort((a,b)=>b[2]-a[2]||cmp(a[3],b[3])||cmp(a[1],b[1]))[0];return best?[best]:[];
  }).sort((a,b)=>b[2]-a[2]||a[0]-b[0]),
  3617: ({students,study_sessions}) => {
    const names=new Map(students.map(r=>[r[0],r]));
    return group(study_sessions,r=>r[1]).flatMap(([id,rows])=>{
      const blocks=[];for(const r of [...rows].sort((a,b)=>cmp(a[3],b[3])||a[0]-b[0])){if(blocks.length&&day(r[3])-day(blocks.at(-1).at(-1)[3])<=2)blocks.at(-1).push(r);else blocks.push([r]);}
      const candidates=blocks.flatMap(rs=>{const size=new Set(rs.map(r=>r[2])).size;return size>=3&&rs.length>=size*2&&rs.every((r,i)=>r[2]===rs[i%size][2])?[[...names.get(id),size,sum(rs,r=>r[4])]]:[];});
      return candidates.sort((a,b)=>b[3]-a[3]||b[4]-a[4]).slice(0,1);
    }).sort((a,b)=>b[3]-a[3]||b[4]-a[4]);
  },
  3482: ({Employees}) => {
    const {levels}=hierarchy(Employees),children=id=>Employees.filter(r=>r[2]===id).flatMap(r=>[r,...children(r[0])]);
    return Employees.filter(r=>levels.has(r[0])).map(r=>{const team=children(r[0]);return [r[0],r[1],levels.get(r[0]),team.length,r[3]+sum(team,r=>r[3])];}).sort((a,b)=>a[2]-b[2]||b[4]-a[4]||cmp(a[1],b[1]));
  },
  3451: ({logs}) => group(logs.filter(r=>{const octets=r[1].split('.');return octets.length!==4||octets.some(x=>!/^(0|[1-9][0-9]{0,2})$/.test(x)||Number(x)>255);}),r=>r[1]).map(([ip,rs])=>[ip,rs.length]).sort((a,b)=>b[1]-a[1]||cmp(b[0],a[0])),
  3368: ({user_content}) => user_content.map(([id,text])=>[id,text,text.toLowerCase().replace(/(^| )[a-z]/g,s=>s.toUpperCase())]),
};

export function playlistExpected(problem,input) {
  return {columns:problem.example.output.columns,rows:playlistRows[problem.number](input)};
}
