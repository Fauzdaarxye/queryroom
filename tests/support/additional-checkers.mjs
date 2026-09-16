// Independent JavaScript checkers also support user-created test inputs.
const result = (columns, rows) => ({columns, rows});
const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const group = (rows, key) => {
  const groups = new Map();
  for (const row of rows) { const value=key(row); if(!groups.has(value)) groups.set(value,[]); groups.get(value).push(row); }
  return groups;
};

export const additionalCheckers = {
  1831: ({Transactions}) => result(['transaction_id'], [...group(Transactions,r=>r[1].slice(0,10))].flatMap(([,rows])=>{
    const maximum=Math.max(...rows.map(r=>r[2]));
    return rows.filter(r=>r[2]===maximum).map(r=>[r[0]]);
  }).sort((a,b)=>a[0]-b[0])),
  1468: ({Salaries}) => result(['company_id','employee_id','employee_name','salary'], [...group(Salaries,r=>r[0])].flatMap(([,rows])=>{
    const maximum=Math.max(...rows.map(r=>r[3])), percentage=maximum<1000?100:maximum<=10000?76:51;
    return rows.map(r=>[...r.slice(0,3),Math.floor((r[3]*percentage+50)/100)]);
  })),
  534: ({Activity}) => result(['player_id','event_date','games_played_so_far'], [...group(Activity,r=>r[0])].flatMap(([id,rows])=>{
    let total=0;
    return [...rows].sort((a,b)=>compare(a[2],b[2])).map(r=>[id,r[2],total+=r[3]]);
  })),
  1398: ({Customers,Orders}) => {
    const bought=new Map([...group(Orders,r=>r[1])].map(([id,rows])=>[id,new Set(rows.map(r=>r[2]))]));
    return result(['customer_id','customer_name'],Customers.filter(([id])=>bought.get(id)?.has('A')&&bought.get(id)?.has('B')&&!bought.get(id)?.has('C')).sort((a,b)=>a[0]-b[0]));
  },
  1715: ({Boxes,Chests}) => {
    const chests=new Map(Chests.map(r=>[r[0],r])), totals=[0,0];
    for(const [,chest,apples,oranges] of Boxes){const inside=chests.get(chest);totals[0]+=apples+(inside?.[1]||0);totals[1]+=oranges+(inside?.[2]||0);}
    return result(['apple_count','orange_count'],[Boxes.length?totals:[null,null]]);
  },
  2041: ({Candidates,Rounds}) => {
    const scores=new Map([...group(Rounds,r=>r[0])].map(([id,rows])=>[id,rows.reduce((sum,r)=>sum+r[2],0)]));
    return result(['candidate_id'],Candidates.filter(r=>r[2]>=2&&(scores.get(r[3])||0)>15).map(r=>[r[0]]));
  },
  1934: ({Signups,Confirmations}) => {
    const messages=group(Confirmations,r=>r[0]);
    return result(['user_id','confirmation_rate'],Signups.map(([id])=>{
      const rows=messages.get(id)||[],confirmed=rows.filter(r=>r[2]==='confirmed').length;
      return [id,rows.length?Math.round(confirmed*100/rows.length)/100:0];
    }));
  },
  1867: ({OrdersDetails}) => {
    const orders=[...group(OrdersDetails,r=>r[0])].map(([id,rows])=>({id,maximum:Math.max(...rows.map(r=>r[2])),average:rows.reduce((sum,r)=>sum+r[2],0)/rows.length}));
    const threshold=Math.max(...orders.map(r=>r.average));
    return result(['order_id'],orders.filter(r=>r.maximum>threshold).map(r=>[r.id]));
  },
  1077: ({Project,Employee}) => {
    const experience=new Map(Employee.map(r=>[r[0],r[2]]));
    return result(['project_id','employee_id'],[...group(Project,r=>r[0])].flatMap(([,rows])=>{
      const maximum=Math.max(...rows.map(r=>experience.get(r[1])));
      return rows.filter(r=>experience.get(r[1])===maximum);
    }));
  },
  2238: ({Rides}) => {
    const passengers=group(Rides,r=>r[2]);
    return result(['driver_id','cnt'],[...new Set(Rides.map(r=>r[1]))].map(id=>[id,passengers.get(id)?.length||0]));
  },
  1355: ({Friends}) => {
    const activities=[...group(Friends,r=>r[2])].map(([name,rows])=>[name,rows.length]);
    const low=Math.min(...activities.map(r=>r[1])),high=Math.max(...activities.map(r=>r[1]));
    return result(['activity'],activities.filter(r=>r[1]>low&&r[1]<high).map(r=>[r[0]]));
  },
  1709: ({UserVisits}) => result(['user_id','biggest_window'],[...group(UserVisits,r=>r[0])].sort(([a],[b])=>a-b).map(([id,rows])=>{
    const dates=rows.map(r=>r[1]).sort();
    const gaps=dates.map((date,i)=>(Date.parse((dates[i+1]||'2021-01-01')+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000);
    return [id,Math.max(...gaps)];
  })),
  1204: ({Queue}) => {
    let total=0,last;
    for(const row of [...Queue].sort((a,b)=>a[3]-b[3])){total+=row[2];if(total>1000) break;last=row[1];}
    return result(['person_name'],last===undefined?[]:[[last]]);
  },
  1112: ({Enrollments}) => result(['student_id','course_id','grade'],[...group(Enrollments,r=>r[0])].sort(([a],[b])=>a-b).map(([,rows])=>[...rows].sort((a,b)=>b[2]-a[2]||a[1]-b[1])[0])),
  1532: ({Customers,Orders}) => {
    const names=new Map(Customers), rows=[...group(Orders,r=>r[2])].flatMap(([id,orders])=>[...orders].sort((a,b)=>compare(b[1],a[1])).slice(0,3).map(r=>[names.get(id),id,r[0],r[1]]));
    return result(['customer_name','customer_id','order_id','order_date'],rows.sort((a,b)=>compare(a[0],b[0])||a[1]-b[1]||compare(b[3],a[3])));
  },
  1445: ({Sales}) => result(['sale_date','diff'], [...group(Sales,r=>r[0])].sort(([a],[b])=>compare(a,b)).map(([day,rows])=>[day,rows.reduce((sum,r)=>sum+(r[1]==='apples'?r[2]:-r[2]),0)])),
  2084: ({Orders}) => {
    const preferred = new Set(Orders.filter(r=>r[2]===0).map(r=>r[1]));
    return result(['order_id','customer_id','order_type'],Orders.filter(r=>r[2]===0 || !preferred.has(r[1])));
  },
  1393: ({Stocks}) => result(['stock_name','capital_gain_loss'],[...group(Stocks,r=>r[0])].map(([name,rows])=>[name,rows.reduce((sum,r)=>sum+(r[1]==='Sell'?r[3]:-r[3]),0)])),
  1783: ({Players,Championships}) => {
    const wins = new Map();
    for(const row of Championships) for(const id of row.slice(1)) wins.set(id,(wins.get(id)||0)+1);
    return result(['player_id','player_name','grand_slams_count'],Players.filter(r=>wins.has(r[0])).map(r=>[...r,wins.get(r[0])]));
  },
  1308: ({Scores}) => {
    const rows=[];
    for(const [gender,scores] of [...group(Scores,r=>r[1])].sort(([a],[b])=>compare(a,b))){
      let total=0;
      for(const row of [...scores].sort((a,b)=>compare(a[2],b[2]))) { total+=row[3]; rows.push([gender,row[2],total]); }
    }
    return result(['gender','day','total'],rows);
  },
  1285: ({Logs}) => {
    const ranges=[];
    for(const id of Logs.map(r=>r[0]).sort((a,b)=>a-b)){
      const previous=ranges.at(-1);
      if(previous && id===previous[1]+1) previous[1]=id;
      else ranges.push([id,id]);
    }
    return result(['start_id','end_id'],ranges);
  },
  1270: ({Employees}) => {
    const reports=new Set([1]);
    for(let added=true;added;){
      added=false;
      for(const [id,,manager] of Employees) if(reports.has(manager)&&!reports.has(id)){reports.add(id);added=true;}
    }
    return result(['employee_id'],Employees.filter(r=>r[0]!==1&&reports.has(r[0])).map(r=>[r[0]]));
  },
  1699: ({Calls}) => {
    const pairs=new Map();
    for(const [from,to,duration] of Calls){
      const a=Math.min(from,to),b=Math.max(from,to),key=`${a},${b}`;
      const row=pairs.get(key)||[a,b,0,0]; row[2]++;row[3]+=duration;pairs.set(key,row);
    }
    return result(['person1','person2','call_count','total_duration'],[...pairs.values()]);
  },
  2066: ({Transactions}) => {
    const rows=[];
    for(const [id,transactions] of [...group(Transactions,r=>r[0])].sort(([a],[b])=>a-b)){
      let balance=0;
      for(const row of [...transactions].sort((a,b)=>compare(a[1],b[1]))) {balance+=row[2]==='Deposit'?row[3]:-row[3];rows.push([id,row[1],balance]);}
    }
    return result(['account_id','day','balance'],rows);
  },
  1596: ({Orders,Products}) => {
    const products=new Map(Products.map(r=>[r[0],r[1]])),rows=[];
    for(const [customer,orders] of group(Orders,r=>r[2])){
      const counts=[...group(orders,r=>r[3])].map(([id,items])=>[id,items.length]);
      const highest=Math.max(...counts.map(r=>r[1]));
      for(const [id,count] of counts) if(count===highest&&products.has(id)) rows.push([customer,id,products.get(id)]);
    }
    return result(['customer_id','product_id','product_name'],rows);
  },
};

// These SELECT statements are private verification queries, compatible with both offered engines.
export const additionalQueries = {
  1831: `WITH ranked AS (SELECT transaction_id,DENSE_RANK() OVER(PARTITION BY DATE(day) ORDER BY amount DESC) AS ranking FROM Transactions) SELECT transaction_id FROM ranked WHERE ranking=1 ORDER BY transaction_id`,
  1468: `WITH taxed AS (SELECT *,MAX(salary) OVER(PARTITION BY company_id) AS highest FROM Salaries) SELECT company_id,employee_id,employee_name,ROUND(salary*CASE WHEN highest<1000 THEN 1.00 WHEN highest<=10000 THEN 0.76 ELSE 0.51 END) AS salary FROM taxed`,
  534: `SELECT player_id,event_date,SUM(games_played) OVER(PARTITION BY player_id ORDER BY event_date ROWS UNBOUNDED PRECEDING) AS games_played_so_far FROM Activity`,
  1398: `SELECT c.customer_id,c.customer_name FROM Customers c JOIN Orders o ON c.customer_id=o.customer_id GROUP BY c.customer_id,c.customer_name HAVING SUM(CASE WHEN product_name='A' THEN 1 ELSE 0 END)>0 AND SUM(CASE WHEN product_name='B' THEN 1 ELSE 0 END)>0 AND SUM(CASE WHEN product_name='C' THEN 1 ELSE 0 END)=0 ORDER BY c.customer_id`,
  1715: `SELECT SUM(b.apple_count+COALESCE(c.apple_count,0)) AS apple_count,SUM(b.orange_count+COALESCE(c.orange_count,0)) AS orange_count FROM Boxes b LEFT JOIN Chests c ON b.chest_id=c.chest_id`,
  2041: `SELECT c.candidate_id FROM Candidates c JOIN Rounds r ON c.interview_id=r.interview_id WHERE c.years_of_exp>=2 GROUP BY c.candidate_id HAVING SUM(r.score)>15`,
  1934: `SELECT s.user_id,ROUND(AVG(CASE WHEN c.action='confirmed' THEN 1.0 ELSE 0.0 END),2) AS confirmation_rate FROM Signups s LEFT JOIN Confirmations c ON s.user_id=c.user_id GROUP BY s.user_id`,
  1867: `WITH quantities AS (SELECT order_id,MAX(quantity) AS maximum,AVG(quantity*1.0) AS average FROM OrdersDetails GROUP BY order_id) SELECT order_id FROM quantities WHERE maximum>(SELECT MAX(average) FROM quantities)`,
  1077: `WITH ranked AS (SELECT p.project_id,p.employee_id,DENSE_RANK() OVER(PARTITION BY p.project_id ORDER BY e.experience_years DESC) AS ranking FROM Project p JOIN Employee e ON p.employee_id=e.employee_id) SELECT project_id,employee_id FROM ranked WHERE ranking=1`,
  2238: `SELECT d.driver_id,COUNT(p.ride_id) AS cnt FROM (SELECT DISTINCT driver_id FROM Rides) d LEFT JOIN Rides p ON d.driver_id=p.passenger_id GROUP BY d.driver_id`,
  1355: `WITH counts AS (SELECT activity,COUNT(*) AS total FROM Friends GROUP BY activity) SELECT activity FROM counts WHERE total>(SELECT MIN(total) FROM counts) AND total<(SELECT MAX(total) FROM counts)`,
  1709: {
    mysql: `WITH visits AS (SELECT user_id,visit_date,LEAD(visit_date,1,'2021-01-01') OVER(PARTITION BY user_id ORDER BY visit_date) AS next_visit FROM UserVisits) SELECT user_id,MAX(DATEDIFF(next_visit,visit_date)) AS biggest_window FROM visits GROUP BY user_id ORDER BY user_id`,
    postgresql: `WITH visits AS (SELECT user_id,visit_date,LEAD(visit_date,1,DATE '2021-01-01') OVER(PARTITION BY user_id ORDER BY visit_date) AS next_visit FROM UserVisits) SELECT user_id,MAX(next_visit-visit_date) AS biggest_window FROM visits GROUP BY user_id ORDER BY user_id`,
    sqlite: `WITH visits AS (SELECT user_id,visit_date,LEAD(visit_date,1,'2021-01-01') OVER(PARTITION BY user_id ORDER BY visit_date) AS next_visit FROM UserVisits) SELECT user_id,MAX(DATEDIFF(next_visit,visit_date)) AS biggest_window FROM visits GROUP BY user_id ORDER BY user_id`,
  },
  1204: `WITH weights AS (SELECT person_name,turn,SUM(weight) OVER(ORDER BY turn ROWS UNBOUNDED PRECEDING) AS total FROM Queue) SELECT person_name FROM weights WHERE total<=1000 ORDER BY turn DESC LIMIT 1`,
  1112: `WITH ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY student_id ORDER BY grade DESC,course_id) AS ranking FROM Enrollments) SELECT student_id,course_id,grade FROM ranked WHERE ranking=1 ORDER BY student_id`,
  1532: `WITH ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY order_date DESC) AS ranking FROM Orders) SELECT c.name AS customer_name,c.customer_id,r.order_id,r.order_date FROM ranked r JOIN Customers c ON r.customer_id=c.customer_id WHERE ranking<=3 ORDER BY customer_name,c.customer_id,r.order_date DESC`,
  1445: `SELECT sale_date, SUM(CASE WHEN fruit='apples' THEN sold_num ELSE -sold_num END) AS diff FROM Sales GROUP BY sale_date ORDER BY sale_date`,
  2084: `SELECT order_id,customer_id,order_type FROM Orders o WHERE order_type=0 OR NOT EXISTS (SELECT 1 FROM Orders preferred WHERE preferred.customer_id=o.customer_id AND preferred.order_type=0)`,
  1393: `SELECT stock_name,SUM(CASE WHEN operation='Sell' THEN price ELSE -price END) AS capital_gain_loss FROM Stocks GROUP BY stock_name`,
  1783: `WITH wins AS (SELECT Wimbledon AS player_id FROM Championships UNION ALL SELECT Fr_open FROM Championships UNION ALL SELECT US_open FROM Championships UNION ALL SELECT Au_open FROM Championships) SELECT p.player_id,p.player_name,COUNT(*) AS grand_slams_count FROM Players p JOIN wins w ON p.player_id=w.player_id GROUP BY p.player_id,p.player_name`,
  1308: `SELECT gender,day,SUM(score_points) OVER(PARTITION BY gender ORDER BY day ROWS UNBOUNDED PRECEDING) AS total FROM Scores ORDER BY gender,day`,
  1285: `WITH ranges AS (SELECT log_id,log_id-ROW_NUMBER() OVER(ORDER BY log_id) AS grp FROM Logs) SELECT MIN(log_id) AS start_id,MAX(log_id) AS end_id FROM ranges GROUP BY grp ORDER BY start_id`,
  1270: `WITH RECURSIVE reports AS (SELECT employee_id FROM Employees WHERE manager_id=1 AND employee_id<>1 UNION ALL SELECT e.employee_id FROM Employees e JOIN reports r ON e.manager_id=r.employee_id WHERE e.employee_id<>1) SELECT employee_id FROM reports`,
  1699: `WITH pairs AS (SELECT CASE WHEN from_id<to_id THEN from_id ELSE to_id END AS person1,CASE WHEN from_id<to_id THEN to_id ELSE from_id END AS person2,duration FROM Calls) SELECT person1,person2,COUNT(*) AS call_count,SUM(duration) AS total_duration FROM pairs GROUP BY person1,person2`,
  2066: `SELECT account_id,day,SUM(CASE WHEN type='Deposit' THEN amount ELSE -amount END) OVER(PARTITION BY account_id ORDER BY day ROWS UNBOUNDED PRECEDING) AS balance FROM Transactions ORDER BY account_id,day`,
  1596: `WITH counts AS (SELECT customer_id,product_id,COUNT(*) AS frequency FROM Orders GROUP BY customer_id,product_id), ranked AS (SELECT *,DENSE_RANK() OVER(PARTITION BY customer_id ORDER BY frequency DESC) AS ranking FROM counts) SELECT r.customer_id,r.product_id,p.product_name FROM ranked r JOIN Products p ON r.product_id=p.product_id WHERE ranking=1`,
};
