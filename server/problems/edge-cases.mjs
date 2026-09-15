// Deterministic, question-specific scenarios. Expected answers come from independent
// JavaScript checkers, never from the SQL query being graded.
const suites=new Map();
const suite=(id,description,scenarios,build)=>suites.set(id,()=>scenarios.map(([name,spec])=>({name,description,input:build(spec)})));
const date=(offset,base='2024-02-25')=>new Date(Date.parse(base+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
const time=(offset,base='2024-02-28T00:00:00Z')=>new Date(Date.parse(base)+offset*1000).toISOString().slice(0,19).replace('T',' ');
const rows=(count,fn)=>Array.from({length:count},(_,i)=>fn(i));

suite(1369,'Select the second activity by date for each user independently; keep single-activity users. Repeated activity names and calendar gaps must not change the ranking.',[
  ['Only one activity',[1]],['Exactly two activities',[2]],['Many activities with repeated names',[7]],['Different history lengths',[1,2,5]],
  ['Second oldest is not second newest',[6,4]],['Several single-activity users',[1,1,1,1]],['Activities across leap day',[3,8,2]],['Long independent histories',[20,15,10]],
],counts=>({UserActivity:counts.flatMap((n,u)=>rows(n,i=>[`User ${u+1}`,i%2?'Study':'Read',date(i*3),date(i*3+1)]))}));

suite(1479,'Sum quantities, not orders, into Monday–Sunday columns; retain categories without sales and combine different items in the same category.',[
  ['Categories without any orders',[]],['Sunday versus Monday',[0,1]],['All seven weekdays',[0,1,2,3,4,5,6]],['Repeated weekday across weeks',[0,7,14,21]],
  ['Several items on one day',[3,3,3]],['Month and year boundary',[0,1,2,30,31]],['Missing middle weekdays',[0,4,6,7,11]],['Many orders and unequal quantities',rows(60,i=>i)],
],days=>({Items:[['a','Book A','Books'],['b','Book B','Books'],['c','Phone','Phones'],['d','Unused','Toys']],Orders:days.map((d,i)=>[i+1,7,date(d,'2023-12-31'),['a','b','c'][i%3],i%9+1])}));

suite(569,'Sort each company by salary and then employee ID. Odd and even company sizes, repeated salaries, and very unequal company sizes exercise the median positions.',[
  ['One employee',[[10]]],['Two employees',[[10,90]]],['Odd count with equal salaries',[[50,50,50]]],['Even count with equal salaries',[[50,50,50,50]]],
  ['Ties straddling the median',[[1,4,4,4,8,9],[3,3,3,5,8]]],['Independent companies',[[8],[1,9],[1,2,3],[9,8,7,6]]],['Wide salary range',[[1,2,999999999,1000000000]]],['One hundred employees',[rows(100,i=>Math.floor(i/10)*100)]],
],companies=>({Employee:companies.flatMap((values,c)=>values.map((salary,i)=>[c*1000+values.length-i,`Company ${c}`,salary]))}));

suite(615,'Compare each department against the employee-weighted company average in the same year and month; departments and years must stay independent.',[
  ['Only one department',[[[10,20]]]],['Equal department averages',[[[10,30],[20]]]],['Different department sizes',[[[10,10,10],[50]]]],['Higher lower and same',[[[10],[20],[30]]]],
  ['Comparison reverses next month',[[[10],[30]],[[40],[20]]]],['Same month in different years',[[[10],[30]],[[20],[20]],[[40],[10]]]],['Fractional averages',[[[1,2],[2,2,3]]]],['Department absent next month',[[[10],[30]],[[20,40]]]],
],months=>({Employee:rows(12,i=>[i+1,Math.floor(i/4)+1]),Salary:months.flatMap((departments,m)=>departments.flatMap((amounts,d)=>amounts.map((amount,i)=>[m*20+d*4+i+1,d*4+i+1,amount,['2023-12-01','2024-01-01','2025-01-01'][m]])))}));

const hiring=[
  ['Exact senior budget',[[70000],[1]]],['Senior just above budget',[[70001],[30000,40000]]],['Only juniors',[[],[10000,20000,40000,50000]]],['Only seniors',[[10000,20000,40000,50000],[]]],
  ['Remainder fits exactly',[[20000,30000],[7000,13000,14000]]],['Senior priority over more juniors',[[69000],[500,501,600]]],['No candidate affordable',[[80000],[90000]]],['Many small candidates',[rows(25,i=>1000+i),rows(25,i=>2000+i)]],
];
for(const id of [2004,2010])suite(id,'Spend at most 70,000, taking the cheapest seniors first and then juniors from the remaining budget. Test missing categories and exact budget limits.',hiring.map(([name,values],i)=>id===2004&&i===7?['Many candidates with equal salaries',[rows(25,()=>1000),rows(25,()=>2000)]]:[name,values]),([senior,junior])=>({Candidates:[...senior.map((s,i)=>[i+1,'Senior',s]),...junior.map((s,i)=>[i+101,'Junior',s])]}));

suite(2199,'Match whole words case-insensitively, deduplicate topic IDs, order them numerically, and keep posts with no matching topic.',[
  ['Whole words versus substrings',['war warning award']],['Mixed case',['WaR VACCINE']],['Repeated matching words',['war war war vaccine']],['Multiple spaces',['  war   vaccine  ']],
  ['Unmatched posts',['nothing matches']],['One word several topics',['war']],['Numeric topic ordering',['war vaccine science']],['Independent posts',['science','warning','vaccine war','warfare']],
],texts=>({Keywords:[[10,'war'],[2,'war'],[2,'vaccine'],[30,'science'],[1,'vaccine']],Posts:texts.map((s,i)=>[i+1,s])}));

suite(1412,'Every exam matters: tied lowest and highest scores disqualify students, and students who never take an exam must be excluded.',[
  ['Single examinee',[[[1,50]]]],['All scores tied',[[[1,50],[2,50],[3,50]]]],['Exactly one quiet student',[[[1,0],[2,50],[3,100]]]],['Tied extremes',[[[1,10],[2,10],[3,50],[4,90],[5,90]]]],
  ['Quiet then highest',[[[1,10],[2,50],[3,90]],[[1,30],[2,90],[3,50]]]],['Quiet in several exams',[[[1,0],[2,50],[3,100]],[[1,20],[2,60],[3,80]]]],['Absent students',[[[2,10],[4,50],[6,90]]]],['Quiet then only examinee',[[[1,10],[2,50],[3,90]],[[2,50]]]],
],exams=>({Student:rows(7,i=>[i+1,`Student ${i+1}`]),Exam:exams.flatMap((entries,e)=>entries.map(([s,score])=>[e+1,s,score]))}));

suite(2362,'Choose the invoice by total quantity × unit price, breaking total-price ties by the smallest invoice ID. Return every line of that invoice.',[
  ['One invoice',[[9,1,1]]],['Equal totals different IDs',[[9,1,2],[2,2,1]]],['Several lines beat one line',[[3,1,3],[3,2,3],[7,3,1]]],['Quantities change the winner',[[1,3,1],[2,1,20]]],
  ['Unused expensive product',[[1,1,1],[2,2,1]]],['Three-way tie',[[9,1,6],[4,2,3],[2,3,2]]],['Large invoice totals',[[1,4,100000],[2,3,100000]]],['Return all winning lines',[[8,1,5],[8,2,5],[8,3,5],[1,4,1]]],
],Purchases=>({Products:[[1,10],[2,20],[3,30],[4,100000]],Purchases}));

suite(1767,'Subtasks are numbered from 1 through each task’s own count. Include both endpoints, retain tasks with no executions, and exclude fully completed tasks.',[
  ['Minimum count none executed',[[2],[]]],['Minimum count all executed',[[2],[1,2]]],['Maximum count none executed',[[20],[]]],['Only first missing',[[5],[2,3,4,5]]],
  ['Only last missing',[[5],[1,2,3,4]]],['Alternating missing subtasks',[[20],[2,4,6,8,10,12,14,16,18,20]]],['Different task sizes',[[2,7,20],[1,2]]],['Many independent tasks',[rows(8,i=>i+2),[1,3]]],
],([counts,executed])=>({Tasks:counts.map((n,i)=>[i*7+3,n]),Executed:counts.flatMap((n,i)=>executed.filter(s=>s<=n).map(s=>[i*7+3,s]))}));

suite(1225,'Merge runs of the same status inside 2019 only, clipping intervals at year boundaries and splitting at both status changes and missing dates.',[
  ['January boundary',['2018-12-30','SSSSS']],['December boundary',['2019-12-29','FFFFF']],['Alternating states',['2019-03-01','SFSFSFSF']],['Only failures',['2019-02-25','FFFFFFFF']],
  ['Only successes',['2019-02-25','SSSSSSSS']],['Long and short runs',['2019-05-01','SSSFFSSFFFFS']],['Calendar month boundary',['2019-01-29','SSSFFFSS']],['Only dates outside 2019',['2020-01-01','SFSF']],
],([start,pattern])=>({Failed:[...pattern].flatMap((s,i)=>s==='F'?[[date(i,start)]]:[]),Succeeded:[...pattern].flatMap((s,i)=>s==='S'?[[date(i,start)]]:[])}));

suite(3057,'Use the average for the employee’s team, require a strictly greater workload, and preserve separate employees even when their names or projects coincide.',[
  ['Single employee teams',[[20],[80]]],['Equal to team average',[[20,20,20]]],['One above average',[[10,20,30]]],['Team average versus global average',[[1,2],[90,100]]],
  ['Unequal team sizes',[[1,1,1,1,6],[90,100]]],['Fractional team average',[[1,2,2]]],['Same names different employees',[[10,90],[20,80]]],['Many project allocations',[rows(20,i=>i+1),rows(20,i=>100-i)]],
],teams=>{let id=0;const Employees=[],Project=[];teams.forEach((values,t)=>values.forEach(workload=>{id++;Employees.push([id,'Alex',`Team ${t}`]);Project.push([id%3+1,id,workload]);}));return {Employees,Project};});

suite(2793,'Confirm passengers in booking-time order within each flight up to its capacity. Passenger IDs and insertion order are unrelated to booking order.',[
  ['One seat one booking',[[1,1]]],['Exactly full',[[3,3]]],['One over capacity',[[3,4]]],['Flights with no bookings',[[5,0],[1,2]]],
  ['Mixed flight capacities',[[1,4],[4,2],[2,3]]],['Zero-capacity flight',[[0,3]]],['Large waitlist',[[1,50]]],['Several fully booked flights',[[2,2],[3,3],[4,4]]],
],flights=>{let n=0;return {Flights:flights.map(([c],i)=>[i+1,c]),Passengers:flights.flatMap(([,count],i)=>rows(count,()=>{n++;return [1000-n,i+1,time(n*67)];}))};});

suite(1159,'Rank sales, not purchases, by date; report every user, including users with fewer than two sales. The second sold item must match that seller’s favorite brand.',[
  ['No sales',[]],['Only one sale',[[1,1]]],['Second sale favorite',[[1,2],[1,1]]],['Only third sale favorite',[[1,2],[1,2],[1,1]]],
  ['First favorite second different',[[1,1],[1,2]]],['Repeated item counts as two sales',[[1,1],[1,1]]],['Independent sellers',[[1,2],[2,1],[1,1],[2,2]]],['Long sale history',rows(20,i=>[i%3+1,i%2+1])],
],sales=>({Users:[[1,'2020-01-01','Alpha'],[2,'2020-01-01','Beta'],[3,'2020-01-01','Alpha'],[4,'2020-01-01','Gamma']],Items:[[1,'Alpha'],[2,'Beta']],Orders:sales.map(([seller,item],i)=>[100-i,date(i),item,seller===4?1:4,seller])}));

suite(1194,'Add points earned on both sides of every match and choose the lowest player ID on a tie. Players without matches still have zero points.',[
  ['No matches',[]],['Zero-score tie',[[1,2,0,0]]],['Winner on second side',[[1,2,1,9]]],['Total score versus best match',[[1,2,4,6],[1,3,4,1]]],
  ['Repeated scores must count',[[1,2,5,2],[1,2,5,2]]],['Tie after switching sides',[[1,2,2,4],[2,1,2,4]]],['Several groups',[[1,2,3,1],[4,5,1,3],[7,8,2,2]]],['Zero-scoring unused smallest ID',[[2,3,0,0],[5,6,0,0]]],
],matches=>({Players:rows(9,i=>[i+1,Math.floor(i/3)+1]),Matches:matches.map((r,i)=>[i+1,...r])}));

suite(1972,'Treat incoming and outgoing calls equally, evaluate first and last calls per calendar day, and emit each qualifying user once.',[
  ['Single call',[[1,2,0]]],['Different first and last contacts',[[1,2,0],[1,3,60]]],['Same contact around another call',[[1,2,0],[1,3,60],[2,1,120]]],['Only incoming calls',[[2,1,0],[3,1,60],[2,1,120]]],
  ['Midnight separates days',[[1,2,86399],[1,3,86400]]],['One qualifying day is enough',[[1,2,0],[1,3,60],[1,4,86400]]],['Repeated qualifying days',[[1,2,0],[2,1,86400],[1,2,172800]]],['Independent users and days',[[8,9,0],[3,4,10],[9,8,60],[3,5,70],[5,3,86400]]],
],calls=>({Calls:calls.map(([a,b,s])=>[a,b,time(s)])}));

suite(2173,'A draw or loss ends a winning streak; calendar gaps between matches do not. Count each player independently, including players with no wins.',[
  ['Only losses',['LLL']],['Only draws',['DDD']],['Single win',['W']],['All wins across calendar gaps',['WWWWWW']],
  ['Draw interrupts wins',['WWDWWW']],['Loss interrupts wins',['WWWLWW']],['Best streak is in the middle',['LWWWWDWWL']],['Several independent players',['WWDLWWW','DDD','WLWLW','WWWWWWWW']],
],patterns=>({Matches:patterns.flatMap((p,u)=>[...p].map((s,i)=>[u+1,date(i*3),{W:'Win',D:'Draw',L:'Lose'}[s]]))}));

suite(2474,'Aggregate all purchases within each year and require a strict increase across consecutive years from the first purchase to the last.',[
  ['Single year qualifies',[[[2020,10]]]],['Equal yearly totals',[[[2020,10],[2021,10]]]],['Missing middle year',[[[2020,10],[2022,30]]]],['Strict increase',[[[2019,10],[2020,20],[2021,30]]]],
  ['One decrease invalidates',[[[2019,10],[2020,30],[2021,20]]]],['Aggregate before comparing',[[[2020,8],[2020,8],[2021,15]]]],['Different customer year ranges',[[[2020,10],[2021,20]],[[2023,20],[2024,10]]]],['Many yearly purchases',[[[2019,1],[2019,2],[2020,2],[2020,3],[2021,6]]]],
],customers=>{let id=0;return {Orders:customers.flatMap((orders,c)=>orders.map(([y,p])=>[++id,c+1,`${y}-06-01`,p]))};});

suite(3214,'Aggregate product spending by calendar year, use the immediately previous year only, retain nulls when no prior year exists, and round growth to two decimals.',[
  ['First year only',[[1,2020,12.34]]],['Positive growth',[[1,2020,10],[1,2021,15]]],['Negative growth',[[1,2020,30],[1,2021,20]]],['Zero growth',[[1,2020,7],[1,2021,7]]],
  ['Missing previous year',[[1,2019,10],[1,2021,20]]],['Aggregate multiple transactions',[[1,2020,10.25],[1,2020,20.5],[1,2021,40.5]]],['Independent products',[[1,2020,10],[1,2021,20],[2,2020,40],[2,2021,10]]],['Fractional growth and year boundary',[[1,2022,3],[1,2023,4],[1,2024,5],[2,2024,0.01]]],
],values=>({user_transactions:values.map(([id,y,spend],i)=>[i+1,id,spend,`${y}-12-31 23:59:59`])}));

suite(3052,'Stock complete batches of each item type, prioritize prime batches, then use only the remaining floor space for non-prime batches.',[
  ['Prime batch exactly fills warehouse',[[500000],[1]]],['Prime batch just too large',[[500001],[250000]]],['Remainder exactly fits non-prime',[[300000],[200000]]],['Remainder cannot fit a batch',[[300000],[200001]]],
  ['Several products per batch',[[100000,100000],[20000,30000]]],['Fractional square footage',[[200000.5],[49999.5]]],['Prime item count differs from batch count',[[50000,50000,50000],[25000,25000]]],['Both batches larger than warehouse',[[600000],[700000]]],
],([prime,other])=>({Inventory:[...prime.map((a,i)=>[i+1,'prime_eligible',`Prime ${i}`,a]),...other.map((a,i)=>[i+101,'not_prime',`Other ${i}`,a])]}));

suite(2991,'Combine records for each winery, break total-point ties alphabetically, and use the required placeholder text for missing second or third wineries.',[
  ['One winery',[[['Alpha',10]]]],['Two wineries',[[['Alpha',10],['Beta',20]]]],['Three tied wineries',[[['Gamma',10],['Beta',10],['Alpha',10]]]],['Aggregate beats individual score',[[['Alpha',7],['Alpha',7],['Beta',10]]]],
  ['Discard fourth place',[[['Delta',1],['Charlie',2],['Beta',3],['Alpha',4]]]],['Different country sizes',[[['Only',1]],[['First',3],['Second',2]],[['A',5],['B',4],['C',3]]]],['Same winery name across countries',[[['Same',10],['Other',20]],[['Same',30],['Other',20]]]],['Repeated scores affect ranking',[[['Alpha',10],['Alpha',10],['Beta',15],['Gamma',5],['Delta',5]]]],
],countries=>{let id=0;return {Wineries:countries.flatMap((w,c)=>w.map(([name,p])=>[++id,`Country ${c}`,p,name]))};});

suite(262,'Exclude trips if either participant is banned, include both cancellation statuses, filter the inclusive three-day period, and round using only eligible trips.',[
  ['All completed',[[1,3,'completed','2013-10-01']]],['All cancelled',[[1,3,'cancelled_by_driver','2013-10-01']]],['Banned client',[[2,3,'cancelled_by_client','2013-10-01']]],['Banned driver',[[1,4,'cancelled_by_driver','2013-10-01']]],
  ['One third cancellation',[[1,3,'completed','2013-10-01'],[1,3,'completed','2013-10-01'],[1,3,'cancelled_by_client','2013-10-01']]],['Both cancellation types',[[1,3,'cancelled_by_driver','2013-10-02'],[1,3,'cancelled_by_client','2013-10-02']]],['Date endpoints and outside dates',['2013-09-30','2013-10-01','2013-10-03','2013-10-04'].map(d=>[1,3,'completed',d])],['Independent daily denominators',[[1,3,'completed','2013-10-01'],[1,3,'cancelled_by_client','2013-10-02'],[2,3,'completed','2013-10-02'],[1,4,'completed','2013-10-02']]],
],trips=>({Users:[[1,'No','client'],[2,'Yes','client'],[3,'No','driver'],[4,'Yes','driver']],Trips:trips.map(([a,b,s,d],i)=>[i+1,a,b,1,s,d])}));

suite(579,'Use the current and preceding two calendar months rather than three rows. Exclude each employee’s own most recent month and keep missing months absent.',[
  ['One month only',[[1]]],['Two adjacent months',[[1,2]]],['Three-month window',[[1,2,3,4]]],['Gaps must contribute zero',[[1,4,7,12]]],
  ['One missing middle month',[[1,3,4,5]]],['Different latest months',[[1,2,3],[2,8],[5]]],['Full year',[rows(12,i=>i+1)]],['Repeated salaries independent employees',[[1,2,5,6,7],[2,3,4,10,11,12]]],
],employees=>({Employee:employees.flatMap((months,e)=>months.map(m=>[e+1,m,10*(e+1)+m%3]))}));

suite(601,'Require at least three consecutive IDs with at least 100 visitors; qualifying runs may span gaps in calendar dates.',[
  ['Only two qualifying rows',[[1,100],[2,100]]],['Exactly three at threshold',[[1,100],[2,100],[3,100]]],['Below threshold breaks run',[[1,100],[2,99],[3,100],[4,100]]],['ID gap breaks run',[[1,100],[2,100],[4,100],[5,100]]],
  ['Long run',rows(12,i=>[i+10,100+i])],['Two separate qualifying runs',[[1,100],[2,101],[3,102],[4,99],[5,100],[6,100],[7,100]]],['No qualifying run',[[1,1],[2,99],[3,2]]],['Nonconsecutive dates consecutive IDs',[[20,100],[21,100],[22,100],[23,100]]],
],data=>({Stadium:data.map(([id,p])=>[id,date(id*2),p])}));

suite(1097,'Retention means returning exactly one calendar day after installation, regardless of device or games played. Count installs once per player and round per cohort.',[
  ['No return',[[0]]],['Exactly next day',[[0,1]]],['Two days later is not retention',[[0,2]]],['Many later logins',[[0,1,2,3,4,5]]],
  ['One of three retained',[[0,1],[0,2],[0]]],['Two of three retained',[[0,1],[0,1,3],[0]]],['Several install cohorts',[[0,1],[0],[2,3],[2,4],[4]]],['Leap day retention',[[3,4],[4,5],[3,5]]],
],players=>({Activity:players.flatMap((days,p)=>days.map((d,i)=>[p+1,i%2+1,date(d),0]))}));

suite(1892,'Recommend only pages liked by a friend but not by the user. Count distinct friends, handle either friendship direction, and never invent a null page.',[
  ['Friends without likes',[]],['One friend likes one page',[[2,10]]],['Own like is excluded',[[1,10],[2,10]]],['Two friends like same page',[[2,10],[3,10]]],
  ['Different pages',[[2,10],[3,20]]],['Mixed own and friend likes',[[1,10],[2,10],[2,20],[3,20],[3,30]]],['All friends like same page',[[1,10],[2,10],[3,10]]],['Unconnected user likes page',[[4,99],[2,10]]],
],Likes=>({Friendship:[[1,2],[1,3]],Likes}));

for(const id of [1919,1917])suite(id,'Only three or more distinct shared songs on the same day qualify. Repeated listens and matches spread across dates must not inflate the count; respect friendship status.',[
  ['Only two shared songs',[2,1,false]],['Exactly three shared songs',[3,1,false]],['Duplicate listens of two songs',[2,3,false]],['Duplicate listens of three songs',[3,3,false]],
  ['Friendship requirement',[3,1,true]],['More than three songs',[5,1,false]],['Shared songs on different dates',[3,1,false,true]],['Several qualifying days',[3,1,false,false,true]],
],([n,repeats,friends,separate,multiday])=>({Friendship:(id===1919?!friends:friends)?[[1,2]]:[],Listens:[0,...(multiday?[1]:[])].flatMap(d=>[1,2].flatMap(u=>rows(n,s=>rows(repeats,()=>[u,s+10,date(d+(separate&&u===2?5:0))])).flat()))}));

suite(2720,'Treat friendships as undirected and divide by the total distinct users, including users who appear only in the second column.',[
  ['One friendship',[[1,2]]],['Three-user chain',[[1,2],[2,3]]],['Star network',[[1,2],[1,3],[1,4],[1,5]]],['Complete triangle',[[1,2],[2,3],[1,3]]],
  ['Disconnected pairs',[[1,2],[3,4]]],['Mixed edge directions',[[9,2],[3,9],[2,3]]],['Fractional percentages',[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]]],['Large network',rows(50,i=>[100,i+1])],
],Friends=>({Friends}));

suite(2752,'Find the longest run of consecutive calendar days for each customer, then retain every customer tied for the global maximum.',[
  ['One transaction',[[0]]],['Tie at one day',[[0],[4],[8]]],['Calendar gap splits run',[[0,1,3,4]]],['One longer streak',[[0,1,2],[0,1]]],
  ['Several tied winners',[[0,1,2],[4,5,6],[0,2]]],['Several equal runs same customer',[[0,1,4,5],[2,3]]],['Leap-day consecutive run',[[2,3,4,5],[0,1]]],['Long streaks',[rows(30,i=>i),rows(29,i=>i),[0,3,6]]],
],customers=>{let id=0;return {Transactions:customers.flatMap((ds,c)=>ds.map(d=>[++id,c*7+2,date(d),10]))};});

suite(2995,'Only users whose earliest session is Viewer qualify; count their Streamer sessions and sort tied counts by user ID descending.',[
  ['Viewer only',['V']],['Streamer first',['SVSS']],['One transition',['VS']],['Several streaming sessions',['VSSS']],
  ['Viewer sessions do not count',['VVVSVS']],['Tied streaming counts',['VSS','VSS','VSS']],['Mixed first-session types',['SVSSS','VSS','VV','VS']],['Long session history',['V'+'S'.repeat(40),'VSS']],
],patterns=>{let id=0;return {Sessions:patterns.flatMap((pattern,u)=>[...pattern].map((s,i)=>[u+1,time(i*7200),time(i*7200+3600),++id,s==='V'?'Viewer':'Streamer']))};});

const organizations=[['CEO alone',[null]],['One direct report',[null,0]],['Deep hierarchy',[null,0,1,2,3,4,5]],['Wide hierarchy',[null,0,0,0,0,0]],['Different branch depths',[null,0,0,1,3,2,5]],['Equal sibling salaries',[null,0,0,1,2]],['Nonconsecutive employee IDs',[null,0,1,0,2,3]],['Large organization',[null,...rows(39,i=>Math.floor(i/3))]]];
for(const id of [3236,3482])suite(id,'Traverse the full hierarchy from a CEO whose ID is not 1. Distinguish direct from indirect reports and include leaf employees and tied salary budgets.',organizations,parents=>({Employees:parents.map((parent,i)=>[i*7+20,`Employee ${String(i).padStart(2,'0')}`,parent===null?null:parent*7+20,10000-(i%3)*1000,...(id===3482?['Operations']:[])])}));

suite(3188,'Require every mandatory major course with grade A, two distinct major electives with grade A/B, and average GPA at least 2.5 including outside-major courses.',[
  ['All criteria met',{}],['Missing mandatory course',{missing:true}],['Mandatory grade below A',{badMandatory:true}],['Only one elective',{oneElective:true}],
  ['Elective grade below B',{badElective:true}],['GPA exactly at threshold',{outside:0}],['GPA below threshold',{outside:-0.1}],['Retaken elective is still one course',{retake:true}],
],spec=>{
  const courses=[[1,'Core One',3,'CS','yes'],[2,'Core Two',3,'CS','yes'],[3,'Option One',3,'CS','no'],[4,'Option Two',3,'CS','no'],[5,'Outside',3,'Art','no']];
  const enrollments=[[1,1,'Spring',spec.badMandatory?'B':'A',3],[1,2,'Spring','A',3],[1,3,'Spring',spec.badElective?'C':'B',2],[1,4,'Spring','B',2]];
  if(spec.missing)enrollments.splice(1,1);
  if(spec.oneElective||spec.retake)enrollments.pop();
  if(spec.retake)enrollments.push([1,3,'Fall','B',3]);
  // Grades/GPA need not use a particular institution's scale; use nonnegative GPAs.
  if(spec.outside!==undefined){for(const r of enrollments)r[4]=3.125+(spec.outside||0);enrollments.push([1,5,'Fall','F',0]);}
  return {students:[[1,'Ada','CS'],[2,'No enrollments','CS']],courses,enrollments};
});

suite(571,'Locate the middle position(s) in the expanded multiset, using frequencies as weights; large frequencies must not require expanding a billion rows.',[
  ['One distinct value',[[7,1]]],['Even split between values',[[1,1],[4,1]]],['Odd weighted median',[[1,2],[9,3]]],['Unweighted median is wrong',[[1,1],[2,1],[100,20]]],
  ['Median spans two buckets',[[1,2],[8,2]]],['Negative and zero values',[[-9,1],[0,1],[4,2]]],['Large frequencies',[[1,1000000000],[9,1000000000]]],['Unequal tails',[[-100,1],[3,7],[100,1]]],
],Numbers=>({Numbers}));

suite(1127,'Classify each user separately on each date. Both-platform users count only in both, with both amounts added, and zero-result platform rows must remain.',[
  ['Desktop only',[[1,0,'desktop',10]]],['Mobile only',[[1,0,'mobile',10]]],['Both platforms',[[1,0,'mobile',10],[1,0,'desktop',20]]],['All three groups',[[1,0,'desktop',10],[2,0,'mobile',20],[3,0,'desktop',30],[3,0,'mobile',40]]],
  ['Platform switches across dates',[[1,0,'desktop',10],[1,1,'mobile',20]]],['Zero amount still counts user',[[1,0,'desktop',0],[2,0,'mobile',0]]],['Equal amounts are not duplicates',[[1,0,'desktop',10],[2,0,'desktop',10]]],['Independent daily groups',[[1,0,'desktop',10],[1,0,'mobile',10],[1,1,'desktop',20],[2,1,'mobile',20]]],
],values=>({Spending:values.map(([id,d,p,a])=>[id,date(d),p,a])}));

suite(1336,'Count transactions per user and visit date, retaining duplicate transactions. Emit every histogram bucket from zero to the maximum, including empty buckets.',[
  ['Visits without transactions',[0,0]],['One transaction',[1]],['Empty middle buckets',[0,3]],['Duplicate transactions',[5]],
  ['Different visits same user',[0,1,2,3]],['No zero-transaction visits',[2,2]],['Many repeated transactions',[0,50]],['Mixed frequency distribution',[0,0,1,1,1,4,4,7]],
],counts=>({Visits:counts.map((_,i)=>[i%2+1,date(i)]),Transactions:counts.flatMap((n,i)=>rows(n,()=>[i%2+1,date(i),10]))}));

const hopperCases=[['No drivers or rides',0],['Driver joins at year end',1],['Drivers before during and after year',2],['Repeated rides by one driver',3],['Unaccepted requests',4],['Leap-day and month boundaries',5],['Sparse months',6],['All months with different distances',7]];
for(const id of [1635,1645,1651])suite(id,'Include every required 2020 month/window, distinguish accepted rides and distinct working drivers, ignore other years, and use three months rather than ride count for rolling averages.',hopperCases,s=>{
  const Drivers=s===0?[]:s===1?[[1,'2020-12-31']]:[[1,'2019-12-31'],[2,'2020-02-29'],[3,'2021-01-01']];
  const days=s<2?[]:s===2?['2019-12-31','2020-01-01','2020-12-31','2021-01-01']:s===3?['2020-03-01','2020-03-02','2020-03-03']:s===4?['2020-04-01','2020-05-01']:s===5?['2020-02-28','2020-02-29','2020-03-01']:s===6?['2020-01-31','2020-12-31']:rows(12,i=>`2020-${String(i+1).padStart(2,'0')}-15`);
  return {Drivers,Rides:days.map((d,i)=>[i+1,9,d]),AcceptedRides:s===4?[]:days.map((d,i)=>[i+1,s===5&&i>0?2:1,i*7+1,i*11+2])};
});

suite(3384,'Attribute a pass to the sending team, distinguish the inclusive 45:00 boundary, and subtract interceptions instead of awarding them to the receiving team.',[
  ['First-half last second',[[1,'45:00',2]]],['Second-half first second',[[1,'45:01',2]]],['Intercepted pass',[[1,'10:00',3]]],['Zero dominance',[[1,'10:00',2],[2,'11:00',3]]],
  ['Negative dominance',[[1,'10:00',3],[2,'11:00',4]]],['Both teams both halves',[[1,'00:00',2],[3,'45:00',4],[2,'45:01',3],[4,'90:00',3]]],['Multiple senders same team',[[1,'10:00',2],[2,'10:01',1],[1,'10:02',3]]],['Independent half totals',[[1,'44:59',3],[1,'45:00',2],[1,'45:01',3],[1,'90:00',2]]],
],Passes=>({Teams:[[1,'Alpha'],[2,'Alpha'],[3,'Beta'],[4,'Beta']],Passes}));

suite(3268,'Touching endpoints do not overlap. Count the greatest simultaneous shift count and sum pairwise overlap minutes, including nested/triple overlaps independently per employee.',[
  ['Single shift',[[[0,60]]]],['Touching shifts',[[[0,60],[60,120]]]],['Partial overlap',[[[0,120],[60,180]]]],['Nested shifts',[[[0,240],[60,120]]]],
  ['Triple overlap',[[[0,240],[60,180],[90,150]]]],['Disjoint overlap groups',[[[0,120],[60,180],[240,360],[300,420]]]],['Independent employees',[[[0,120],[60,180]],[[0,60],[60,120]]]],['Same clock different dates',[[[0,60],[1440,1500]]]],
],employees=>({EmployeeShifts:employees.flatMap((shifts,e)=>shifts.map(([a,b])=>[e+1,time(a*60),time(b*60)]))}));

suite(618,'Sort names separately within each continent, preserve duplicate student rows, and pad shorter columns with nulls. America has at least as many students as either other continent.',[
  ['America only',[['Zoe'],[],[]]],['One student per continent',[['Zoe'],['Bo'],['Eva']]],['Unequal continent sizes',[['Zoe','Ada','Mia'],['Xi'],['Eve','Bob']]],['Duplicate names',[['Ada','Ada','Zoe'],['Xi','Xi'],[]]],
  ['Same name different continents',[['Alex','Ben'],['Alex'],['Alex']]],['Already sorted',[['Ada','Bob'],['Chen','Xi'],['Eva','Zoe']]],['Empty Europe column',[['Zoe','Bob','Ada'],['Xi','Chen'],[]]],['Many students',[rows(30,i=>`Name ${String(30-i).padStart(2,'0')}`),['Xi'],['Eva']]],
],lists=>({Student:lists.flatMap((names,i)=>names.map(name=>[name,['America','Asia','Europe'][i]]))}));

suite(3673,'A zombie session lasts strictly more than 30 minutes, has at least five scrolls, a click/scroll ratio strictly below 0.20, and no purchases, regardless of purchase amount.',[
  ['Exactly thirty minutes',[[1800,5,0,false]]],['One second over thirty minutes',[[1801,5,0,false]]],['Only four scrolls',[[2400,4,0,false]]],['Ratio exactly one fifth',[[2400,5,1,false]]],
  ['Ratio just below one fifth',[[2400,6,1,false]]],['Purchase disqualifies session',[[2400,6,0,true]]],['Independent sessions same user',[[2400,5,0,false],[2400,5,0,true]]],['Scroll count and session tie ordering',[[2400,6,0,false],[2400,8,1,false],[2400,8,0,false]]],
],sessions=>{let id=0;return {app_events:sessions.flatMap(([duration,scrolls,clicks,purchase],s)=>{
  const session=`S${3-s}`,start=s*86400,events=[['app_open',null],...rows(scrolls,()=>['scroll',10]),...rows(clicks,()=>['click',null]),...(purchase?[['purchase',0]]:[])];
  return [...events.map(([type,value],i)=>[++id,7,time(start+i),type,session,value]),[++id,7,time(start+duration),'app_close',session,null]];
})};});

suite(3554,'Count unique customers per category pair, not product combinations or quantities, and report only pairs purchased by at least three customers.',[
  ['Only two customers',[2,false]],['Exactly three customers',[3,false]],['Repeated category products',[3,true]],['Huge quantities one customer',[1,true]],
  ['Several category pairs',[3,false,true]],['Unequal pair counts',[4,false,true]],['Unused category',[3,true,false,true]],['Many buyers',[20,true,true]],
],([n,duplicate,third,unused])=>({ProductInfo:[[1,'Books',10],[2,'Games',20],[3,'Books',30],[4,'Toys',40],...(unused?[[5,'Unused',50]]:[])],ProductPurchases:rows(n,u=>[[u+1,1,100],[u+1,2,100],...(duplicate?[[u+1,3,200]]:[]),...(third&&u<3?[[u+1,4,1]]:[])]).flat()}));

suite(2994,'Emit all four Fridays in November 2023, total every purchase on the date, and use zero for Fridays without purchases while ignoring other weekdays.',[
  ['No purchases',[]],['Only non-Fridays',[[1,1,10],[1,30,20]]],['First Friday only',[[1,3,10]]],['Last Friday only',[[1,24,20]]],
  ['Every Friday',[[1,3,10],[1,10,20],[1,17,30],[1,24,40]]],['Several buyers same Friday',[[1,10,10],[2,10,10],[3,10,20]]],['Same buyer multiple purchases',[[1,17,10],[1,17,20]]],['Neighboring weekdays',[[1,2,999],[1,3,10],[1,4,999],[1,23,999],[1,24,20],[1,25,999]]],
],purchases=>({Purchases:purchases.map(([u,d,a])=>[u,`2023-11-${String(d).padStart(2,'0')}`,a])}));

suite(2494,'Merge intervals sharing a day, including duplicate and nested events and chains of overlap. Adjacent days without a shared day remain separate; halls stay independent.',[
  ['One event',[[1,0,1]]],['Duplicate event',[[1,0,3],[1,0,3]]],['Nested events',[[1,0,10],[1,2,3],[1,5,6]]],['Shared endpoint',[[1,0,3],[1,3,6]]],
  ['Adjacent but no shared day',[[1,0,3],[1,4,6]]],['Transitive overlap chain',[[1,0,3],[1,2,5],[1,4,7]]],['Same dates different halls',[[1,0,3],[2,0,3],[1,2,5]]],['Equal starts different ends',[[1,0,3],[1,0,10],[1,8,12],[1,15,16]]],
],events=>({HallEvents:events.map(([id,a,b])=>[id,date(a),date(b)])}));

suite(3060,'Measure the gap from the earlier session’s end to the later session’s start, within the same user and session type, including exactly twelve hours.',[
  ['Exactly twelve-hour gap',[43200,'Viewer','Viewer']],['One second above limit',[43201,'Viewer','Viewer']],['One second below limit',[43199,'Viewer','Viewer']],['Touching sessions',[0,'Viewer','Viewer']],
  ['Different session types',[3600,'Viewer','Streamer']],['Streamer sessions qualify',[3600,'Streamer','Streamer']],['Different users do not qualify',[3600,'Viewer','Viewer',true]],['Long first session short gap',[3600,'Viewer','Viewer',false,86400]],
],([gap,a,b,different,duration=3600])=>({Sessions:[[1,time(0),time(duration),10,a],[different?2:1,time(duration+gap),time(duration+gap+3600),2,b]]}));

suite(3764,'Only students with at least five courses and average rating at least four contribute. Count chronological adjacent transitions, preserving direction and aggregating across students.',[
  ['Four excellent courses',[[5,5,5,5]]],['Exactly five at threshold',[[4,4,4,4,4]]],['Average just below threshold',[[4,4,4,4,3]]],['Mixed ratings average four',[[5,5,4,3,3]]],
  ['Several top students',[[4,4,4,4,4],[5,5,5,5,5]]],['Ignore nonqualifying student',[[4,4,4,4,4],[1,1,1,1,1]]],['Longer pathways',[[5,5,5,5,5,5,5]]],['Different chronological directions',[[4,4,4,4,4],[5,5,5,5,5],[4,4,4,4,4]]],
],students=>({course_completions:students.flatMap((ratings,u)=>ratings.map((r,i)=>{const c=u===2?ratings.length-i:i+1;return [u+1,c,`Course ${c}`,date(i*2),r];}))}));

suite(3832,'A qualifying streak needs five consecutive dates with exactly one identical action each day. A missing date, second action, or action change breaks the streak.',[
  ['Only four days',{n:4}],['Exactly five days',{n:5}],['Six consecutive days',{n:6}],['One missing date',{n:6,gap:true}],
  ['Additional action in the middle',{n:7,extra:true}],['Different action in the middle',{n:7,change:true}],['Only the longest sequence',{n:5,second:7}],['Independent users and leap day',{n:8,users:3}],
],s=>({activity:rows(s.users||1,u=>[...rows(s.n,i=>[u+1,date(i+(s.gap&&i>=3?1:0)),s.change&&i===3?'logout':'login']),...(s.extra?[[u+1,date(3),'view']]:[]),...rows(s.second||0,i=>[u+1,date(i+20),'view'])]).flat()}));

suite(3617,'Require at least three subjects in the same rotating order for two full cycles; distinguish a two-day gap from a three-day gap and total only the qualifying pattern.',[
  ['Only two subjects',{size:2,cycles:3}],['One cycle only',{size:3,cycles:1}],['Exactly two full cycles',{size:3,cycles:2}],['Four-subject cycle',{size:4,cycles:2}],
  ['Allowed two-day gaps',{size:3,cycles:2,gap:2}],['Three-day gap breaks cycles',{size:3,cycles:2,break:true}],['Same subjects wrong order',{size:3,cycles:2,wrong:true}],['Several cycles and students',{size:4,cycles:3,users:2}],
],s=>{let id=0;return {students:rows(s.users||1,u=>[u+1,`Student ${u}`,'Science']),study_sessions:rows(s.users||1,u=>rows(s.size*s.cycles,i=>[++id,u+1,`Subject ${s.wrong&&i===s.size?1:i%s.size}`,date(i*(s.gap||1)+(s.break&&i>=s.size?2:0)),1.25+u])).flat()};});

suite(3451,'Check all four octets for range and leading zeros, preserve valid zero and 255 values, count repeated invalid addresses, and sort ties by IP descending.',[
  ['Valid boundary addresses',['0.0.0.0','255.255.255.255']],['Each octet over 255',['256.1.1.1','1.256.1.1','1.1.256.1','1.1.1.256']],['Leading zero in each octet',['01.1.1.1','1.01.1.1','1.1.01.1','1.1.1.01']],['Wrong number of octets',['1.2.3','1.2.3.4.5']],
  ['Zero versus leading zeros',['0.1.2.3','00.1.2.3','1.0.2.3']],['Repeated invalid addresses',['256.1.1.1','256.1.1.1','1.2.3']],['Count tie ordering',['9.8.7','1.2.3','9.8.7','1.2.3']],['Mixed valid and invalid',['192.168.1.1','255.0.10.1','300.0.10.1','192.168.001.1','999.999.999.999']],
],ips=>({logs:ips.map((ip,i)=>[i+1,ip,i%2?200:500])}));

suite(3368,'Uppercase each word’s first letter, lowercase the rest, and preserve every existing space and every separate content row.',[
  ['One letter',['a']],['All uppercase',['HELLO WORLD']],['Mixed case',['hELLo wORLd']],['Leading spaces',['   hello world']],
  ['Trailing spaces',['hello world   ']],['Repeated internal spaces',['hello    world  of   SQL']],['Repeated content distinct IDs',['same text','same text']],['Long text and single-letter words',['a I x','  '+rows(80,i=>i%2?'sQL':'pOSTGRESQL').join('  ')+'  ']],
],texts=>({user_content:texts.map((text,i)=>[i+1,text])}));

suite(1445,'Subtract oranges from apples per date, including negative and zero differences; never combine dates across months or years.',[
  ['Equal fruit sales',[[10,10]]],['Only apples sold',[[20,0]]],['Only oranges sold',[[0,20]]],['Neither fruit sold',[[0,0]]],
  ['Alternating signs',[[10,20],[20,10],[10,10]]],['Large counts',[[1000000000,1]]],['Same day number different months',[[1,5],[8,2],[7,7]]],['Many sales dates',rows(30,i=>[i,30-i])],
],values=>({Sales:values.flatMap(([a,o],i)=>[[date(i*31),'apples',a],[date(i*31),'oranges',o]])}));

suite(2084,'For each customer, keep all type-0 orders if any exist; otherwise keep all type-1 orders. Do not reduce a customer to just one order.',[
  ['Only type zero',[[0]]],['Only type one',[[1]]],['Both types',[[1,0]]],['Several preferred orders',[[0,1,0,1,0]]],
  ['Several fallback orders',[[1,1,1]]],['Independent customers',[[0,1],[1,1],[0,0]]],['Late preferred order',[[1,1,1,1,0]]],['Many orders',[rows(40,i=>i%2),rows(30,()=>1)]],
],customers=>{let id=0;return {Orders:customers.flatMap((orders,c)=>orders.map(type=>[++id,c+1,type]))};});

suite(1393,'Add every sell and subtract every buy for each stock, including repeated prices, losses, and break-even positions. Every buy has a later sell.',[
  ['Profit',[[[10,20]]]],['Loss',[[[20,10]]]],['Break even',[[[10,10]]]],['Repeated trades',[[[10,20],[10,20],[10,20]]]],
  ['Profit offsets loss',[[[10,30],[30,10]]]],['Independent stocks',[[[1,8]],[[8,1]],[[5,5]]]],['Large accumulated amounts',[[[1000000000,1],[1000000000,1]]]],['Many buy sell pairs',[rows(30,i=>[i+1,31-i])]],
],stocks=>({Stocks:stocks.flatMap((trades,s)=>trades.flatMap(([a,b],i)=>[[`Stock ${s}`,'Buy',i*2+1,a],[`Stock ${s}`,'Sell',i*2+2,b]]))}));

suite(1783,'Count every tournament title, including multiple titles by the same player in one year; omit players without any wins.',[
  ['One player wins all four',[[1,1,1,1]]],['Four different winners',[[1,2,3,4]]],['Two titles each',[[1,2,1,2]]],['Same champion every year',[[1,1,1,1],[1,1,1,1]]],
  ['Different annual champions',[[1,1,1,1],[2,2,2,2]]],['Equal totals different players',[[1,2,3,4],[4,3,2,1]]],['Only last tournament won',[[1,1,1,2]]],['Many seasons',rows(25,i=>[i%4+1,(i+1)%4+1,(i+2)%4+1,(i+3)%4+1])],
],seasons=>({Players:rows(6,i=>[i+1,`Player ${i}`]),Championships:seasons.map((wins,i)=>[2000+i,...wins])}));

suite(1308,'Accumulate points chronologically within each gender, including zero-point days and gaps; sort gender first and date second.',[
  ['Female team only',[[1,2,3],[]]],['Male team only',[[],[1,2,3]]],['Both teams same dates',[[1,5],[9,2]]],['Zero points',[[0,0,1],[0,2,0]]],
  ['Different history lengths',[[1],[2,3,4,5]]],['Repeated points',[[3,3,3],[7,7]]],['Large running totals',[[1000000000,1000000000],[1]]],['Long independent histories',[rows(30,i=>i),rows(30,i=>30-i)]],
],teams=>({Scores:teams.flatMap((points,g)=>points.map((p,i)=>[`Player ${i%2}`,g?'M':'F',date(i*2),p]))}));

suite(1285,'Group consecutive numeric IDs without assuming IDs begin at one; retain isolated IDs and split ranges at every missing number.',[
  ['One log',[9]],['Two consecutive logs',[8,9]],['All isolated',[1,3,5,7]],['One long range',rows(50,i=>i+100)] ,
  ['Missing one number',[1,2,4,5]],['Isolated endpoints',[1,4,5,6,9]],['Near numeric limit',[999999997,999999998,1000000000]],['Several differently sized ranges',[2,3,9,12,13,14,20,21,22,23]],
],ids=>({Logs:ids.map(id=>[id])}));

suite(1270,'Return direct and indirect reports to employee 1, excluding employee 1 itself. Traverse up to the three reporting levels allowed by the question.',[
  ['Head only',[[1,1]]],['Direct report',[[1,1],[2,1]]],['Two levels',[[1,1],[2,1],[3,2]]],['Three levels',[[1,1],[2,1],[3,2],[4,3]]],
  ['Several direct reports',[[1,1],[2,1],[3,1],[4,1]]],['Other self-managed branch',[[1,1],[2,1],[9,9],[10,9]]],['Nonconsecutive IDs',[[1,1],[99,1],[42,99],[8,42]]],['Wide three-level tree',[[1,1],[2,1],[3,1],[4,2],[5,2],[6,3],[7,4],[8,5],[9,6]]],
],employees=>({Employees:employees.map(([id,manager])=>[id,`Employee ${id}`,manager])}));

suite(1699,'Normalize both call directions to the same ordered pair and count every call, including exact duplicate rows, without merging different pairs.',[
  ['One call',[[1,2,5]]],['Reverse direction',[[9,2,8]]],['Both directions',[[1,2,5],[2,1,7]]],['Identical duplicate calls',[[1,2,5],[1,2,5],[1,2,5]]],
  ['Several pairs',[[1,2,5],[1,3,7],[2,3,9]]],['Same totals different pairs',[[1,2,5],[3,4,5]]],['Large total duration',[[1,2,1000000000],[2,1,1000000000]]],['Many repeated calls',rows(100,i=>[i%2?2:1,i%2?1:2,i+1])],
],Calls=>({Calls}));

suite(2066,'Compute a chronological running balance independently for every account, adding deposits and subtracting withdrawals, with no reset across calendar boundaries.',[
  ['Deposit only',[[100]]],['Back to zero',[[100,-100]]],['Several withdrawals',[[100,-20,-30,-50]]],['Deposit after zero',[[100,-100,30]]],
  ['Different accounts',[[100,-20],[10,20]]],['Repeated amounts',[[10,10,10,-10,-10]]],['Large balances',[[1000000000,1000000000,-1]]],['Many transactions',[rows(30,i=>i%2?-10:20),[50,-50]]],
],accounts=>({Transactions:accounts.flatMap((values,a)=>values.map((v,i)=>[a+1,date(i*31),v<0?'Withdraw':'Deposit',Math.abs(v)]))}));

suite(1596,'Find each customer’s most frequently ordered products, preserve all ties, count orders rather than prices, and exclude customers without orders.',[
  ['No orders',[]],['Single order',[[1]]],['Tie between products',[[1,2]]],['Three-way tie',[[1,2,3]]],
  ['Repeated favorite',[[1,1,1,2,2]]],['Independent favorites',[[1,1,2],[2,2,1]]],['Cheapest product most frequent',[[1,1,1,3]]],['Long tied history',[rows(50,i=>i%2+1)]],
],customers=>{let id=0;return {Customers:rows(customers.length+1,i=>[i+1,`Customer ${i}`]),Products:[[1,'Pen',1],[2,'Book',10],[3,'Phone',1000]],Orders:customers.flatMap((products,c)=>products.map((p,i)=>[++id,date(i),c+1,p]))};});

suite(1831,'Find every maximum-amount transaction for each complete calendar date, ignoring time of day while retaining all maximum ties.',[
  ['One transaction',[[0,10]]],['Same day different times',[[0,1],[3600,10],[86399,5]]],['All tied within a day',[[0,10],[1,10],[2,10]]],['Midnight separates days',[[86399,100],[86400,1]]],
  ['Daily maxima differ',[[0,100],[1,90],[86400,1],[86401,2]]],['Maximum tie at different times',[[0,9],[3600,9],[8000,1]]],['Same day number in different years',[[0,10],[366*86400,20]]],['Many daily groups',rows(60,i=>[i*36000,i%5])],
],data=>({Transactions:data.map(([seconds,amount],i)=>[1000-i,time(seconds),amount])}));

suite(1468,'Apply the tax bracket selected by each company’s maximum salary to every employee, treating 1000 and 10000 inclusively and rounding the final salary.',[
  ['Just below lower threshold',[[999]]],['Exactly lower threshold',[[1000,101]]],['Exactly upper threshold',[[10000,99]]],['Just above upper threshold',[[10001,50,51]]],
  ['Several independent tax brackets',[[999],[1000],[10000],[10001]]],['Tied maximum salaries',[[1000,1000,500]]],['Half-unit rounding',[[10050,50,150]]],['Large company and repeated names',[rows(50,i=>i*251+1)]],
],companies=>({Salaries:companies.flatMap((values,c)=>values.map((salary,e)=>[c+1,e+1,'Alex',salary]))}));

suite(534,'Sum games within each player’s chronological history, retaining zero-game days and changes in device; calendar gaps do not reset the total.',[
  ['One login',[[7]]],['All zero games',[[0,0,0]]],['Mixed zero and nonzero games',[[1,0,4]]],['Repeated daily amounts',[[3,3,3]]],
  ['Independent players',[[1,2,3],[10,20]]],['One long and one short history',[rows(20,i=>i),[1]]],['Large cumulative total',[[1000000000,1000000000]]],['Many device changes',[rows(50,i=>i%5)]],
],players=>({Activity:players.flatMap((values,p)=>values.map((games,i)=>[p+1,i%3+1,date(i*3),games]))}));

suite(1398,'Require both A and B and exclude any customer who ever ordered C. Repeated purchases and unrelated products cannot substitute for either required product.',[
  ['Both required products',['AB']],['Forbidden product also present',['ABC']],['Repeated A without B',['AAAA']],['B without A',['BB']],
  ['Duplicates and unrelated products',['AABBD']],['Independent customers',['AB','AC','BC','ABC','D']],['No orders',['']],['Same names sorted by ID',['AB','AB','C','AB']],
],customers=>{let id=0;return {Customers:customers.map((_,c)=>[c+1,'Alex']),Orders:customers.flatMap((products,c)=>[...products].map(p=>[++id,c+1,p]))};});

suite(1715,'Sum fruit inside boxes plus their optional referenced chests, retain boxes without a chest, and never include unreferenced chests.',[
  ['One box no chest',[[null,1,2]]],['Only chest fruit',[[1,0,0]]],['Box and chest fruit',[[1,3,4]]],['Shared chest counted per box',[[1,0,0],[1,1,1]]],
  ['Mixed optional chests',[[null,1,2],[1,3,4],[2,5,6]]],['All counts zero',[[null,0,0]]],['Large fruit totals',[[1,1000000000,1000000000],[2,1000000000,1000000000]]],['Many boxes',rows(50,i=>[i%3?1:null,i,i+1])],
],boxes=>({Boxes:boxes.map((r,i)=>[i+1,...r]),Chests:[[1,2,3],[2,5,7],[9,1000000,1000000]]}));

suite(2041,'Candidates need at least two years of experience and a sum of round scores strictly greater than fifteen; group by candidate/interview, not name.',[
  ['Exactly two years score sixteen',[[2,[8,8]]]],['Score exactly fifteen',[[2,[7,8]]]],['One year high score',[[1,[10,10]]]],['Many rounds total sixteen',[[3,[4,4,4,4]]]],
  ['No interview rounds',[[5,[]]]],['Independent interviews',[[1,[10,10]],[2,[7,8]],[2,[8,8]]]],['One strong round is insufficient',[[2,[10,1,1]]]],['Many candidates',rows(20,i=>[i%4,[i%11,(i+3)%11]])],
],candidates=>({Candidates:candidates.map(([years],i)=>[i+1,'Alex',years,100+i]),Rounds:candidates.flatMap(([,scores],i)=>scores.map((score,r)=>[100+i,r+1,score]))}));

suite(1934,'Keep every signup, divide confirmed messages by all messages, return zero for users without messages, and round each rate to two decimal places.',[
  ['No confirmation messages',['']],['All confirmed',['CCC']],['All expired',['TTT']],['One third confirmed',['CTT']],
  ['Two thirds confirmed',['CCT']],['One eighth confirmed',['CTTTTTTT']],['Independent user rates',['','CCC','TTT','CT']],['Many confirmation messages',['C'.repeat(33)+'T'.repeat(67)]],
],users=>({Signups:users.map((_,i)=>[i+1,time(0)]),Confirmations:users.flatMap((actions,u)=>[...actions].map((a,i)=>[u+1,time(i+1),a==='C'?'confirmed':'timeout']))}));

suite(1867,'An order qualifies only if its maximum quantity is strictly greater than every order’s average, not merely its own average or the average of all rows.',[
  ['Single one-line order',[[5]]],['Single varied order',[[1,9]]],['Maximum equals highest average',[[1,9],[9]]],['Threshold imposed by another order',[[1,9],[10]]],
  ['Unequal order sizes',[[1,1,1,9],[4]]],['Fractional average',[[1,2],[1,3]]],['Several qualifying orders',[[1,9],[2,8],[3,7]]],['All quantities equal',[[5,5],[5],[5,5,5]]],
],orders=>({OrdersDetails:orders.flatMap((quantities,o)=>quantities.map((q,p)=>[o+1,p+1,q]))}));

suite(1077,'Find the greatest experience within each project and return all tied employees. One employee may work on several projects; unassigned employees are irrelevant.',[
  ['One employee',[[1]]],['One best employee',[[1,2,3]]],['Two tied best employees',[[2,3]]],['All zero experience',[[1,4]]],
  ['Independent projects',[[1,2],[1,4]]],['Same employee on many projects',[[2],[2,3],[1,2,4]]],['Several complete ties',[[2,3],[2,3],[1,4]]],['Repeated names different employees',[[1,2,3,4]]],
],projects=>({Employee:[[1,'Alex',0],[2,'Alex',10],[3,'Alex',10],[4,'Alex',0],[5,'Unused',99]],Project:projects.flatMap((ids,p)=>ids.map(id=>[p+1,id]))}));

suite(2238,'List distinct drivers and count how many rides they took as passengers, including repeated rides, while retaining drivers who were never passengers.',[
  ['One driver never passenger',[[1,2]]],['Drivers ride with each other',[[1,2],[2,1]]],['Repeated rides',[[1,2],[1,2],[2,1]]],['Three-person cycle',[[1,2],[2,3],[3,1]]],
  ['Only passengers are not drivers',[[1,8],[2,8]]],['Many rides same driver',rows(30,()=>[1,2])],['Several passengers same driver',[[1,2],[1,3],[1,4],[2,1],[3,1]]],['Independent groups',[[1,2],[2,1],[3,4],[4,3]]],
],rides=>({Rides:rides.map((r,i)=>[i+1,...r])}));

suite(1355,'Exclude every activity tied for the smallest or largest participant count; include all strictly middle counts, counting friends rather than distinct names.',[
  ['One activity',[3]],['Two activities',[1,3]],['All counts tied',[2,2,2]],['Exactly one middle',[1,2,3]],
  ['Tied smallest counts',[1,1,2,3]],['Tied largest counts',[1,2,3,3]],['Several middle activities',[1,2,3,4]],['Larger activity groups',[5,10,15,20,25]],
],counts=>{let id=0;return {Activities:counts.map((_,a)=>[a+1,`Activity ${a}`]),Friends:counts.flatMap((n,a)=>rows(n,()=>[++id,'Alex',`Activity ${a}`]))};});

suite(1709,'Include the final gap to the fixed date 2021-01-01, preserve duplicate visit dates as zero-length gaps, and calculate calendar days across leap year correctly.',[
  ['Only one visit',[[0]]],['Visit on fixed deadline',[[366]]],['Repeated visit date',[[0,0,0]]],['Final gap largest',[[0,1,2]]],
  ['Interior gap largest',[[0,300,365]]],['Leap-day interval',[[58,60,365]]],['Independent users',[[0,100,200,366],[300],[365,366]]],['Many visits',[rows(60,i=>i*6)]],
],users=>({UserVisits:users.flatMap((days,u)=>days.map(d=>[u+1,date(d,'2020-01-01')]))}));

suite(1204,'Board in turn order without skipping an overweight next passenger. Capacity is 1000 inclusive, and person IDs need not match turn order.',[
  ['One person at capacity',[1000]],['Two exactly fit',[400,600]],['One over capacity',[400,601]],['Cannot skip next person',[400,700,100]],
  ['Everyone fits',[100,200,300]],['Exactly one fits',[800,300,100]],['Equal weights',[250,250,250,250,250]],['Long queue',rows(100,()=>11)],
],weights=>({Queue:weights.map((weight,i)=>[weights.length-i,`Person ${i+1}`,weight,i+1])}));

suite(1112,'Choose each student’s highest grade and then smallest course ID among tied best grades; keep students separate and order by student ID.',[
  ['One course',[[50]]],['Unique highest grade',[[10,99,50]]],['All courses tied',[[90,90,90]]],['Zero grades',[[0,0]]],
  ['Two-way highest tie',[[80,90,90]]],['Independent students',[[10,20],[100],[30,30,30]]],['Perfect scores tie',[[100,100,99]]],['Many courses',[rows(50,i=>i%5*20)]],
],students=>({Enrollments:students.flatMap((grades,s)=>grades.map((grade,c)=>[s+1,grades.length-c,grade]))}));

suite(1532,'Return up to three newest orders per customer, sorted by customer name, ID, and date descending. Exclude customers with no orders and rank by dates rather than order IDs.',[
  ['Customer without orders',[0]],['One order',[1]],['Exactly two orders',[2]],['Exactly three orders',[3]],
  ['Fourth order excluded',[4]],['Different history lengths',[0,1,2,3,7]],['Same customer names',[5,5,5]],['Long customer histories',[30,25,20]],
],counts=>{let id=1000;return {Customers:counts.map((_,c)=>[c+1,c%2?'Alex':'Zoe']),Orders:counts.flatMap((n,c)=>rows(n,i=>[id--,date(i*2),c+1,i+1]))};});

suite(1459,'Exercise coordinate limits, dense grids, repeated positions and many equal areas while requiring nonzero rectangles and every specified tie-break.',[
  ['Opposite coordinate limits',[[1,-1000000,-1000000],[2,1000000,1000000]]],['Unit-width tall rectangles',[[1,0,-1000000],[2,1,1000000],[3,1,0]]],
  ['Dense square grid',rows(25,i=>[i+1,i%5,Math.floor(i/5)])],['Many points at two locations',rows(20,i=>[i+1,i%2?3:0,i%2?4:0])],
  ['Cross-shaped degeneracies',rows(19,i=>[i+1,i<10?i-5:0,i<10?0:i-14])],['One hundred distinct diagonal points',rows(100,i=>[100-i,i,i*3])],
  ['Negative-quadrant tied areas',[[1,-1,-1],[2,-3,-3],[3,-1,-3],[4,-3,-1],[5,-2,-2]]],['Large nonconsecutive identifiers',[[999999,0,0],[7,1,1],[300000,2,2],[2,3,3]]],
],Points=>({Points}));

export function expandEdgeCases(problem) {
  const build=suites.get(problem.number);
  if(!build)throw new Error(`Missing edge cases for #${problem.number}`);
  const fixtures=build().map((test,i)=>{
    // Reproducible shuffle: none of these fixtures depends on insertion order.
    let seed=problem.number*100+i;
    const input=Object.fromEntries(Object.entries(test.input).map(([name,data])=>{
      const shuffled=data.map(row=>[...row]);
      for(let j=shuffled.length-1;j>0;j--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const k=seed%(j+1);[shuffled[j],shuffled[k]]=[shuffled[k],shuffled[j]];}
      return [name,shuffled];
    }));
    return {...test,id:`edge-${i+1}`,kind:'Edge case',input,expected:problem.expected(input)};
  });
  return {...problem,practiceCases:[...problem.practiceCases,...fixtures],submissionCases:[...problem.submissionCases,...fixtures],testNotes:'Published examples, earlier practice cases, and eight additional question-specific edge cases with independently calculated answers. These are local practice tests, not LeetCode’s private tests.'};
}
