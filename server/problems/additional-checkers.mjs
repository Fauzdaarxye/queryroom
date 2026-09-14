// Independent JavaScript checkers also support user-created test inputs.
const result = (columns, rows) => ({columns, rows});
const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const group = (rows, key) => {
  const groups = new Map();
  for (const row of rows) { const value=key(row); if(!groups.has(value)) groups.set(value,[]); groups.get(value).push(row); }
  return groups;
};

export const additionalCheckers = {
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
