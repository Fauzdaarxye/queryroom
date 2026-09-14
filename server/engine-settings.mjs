import fs from 'node:fs/promises';

export function engineMode(env=process.env) {
  const mode=env.QUERYROOM_ENGINE_MODE || 'local';
  if(!['local','external'].includes(mode)) throw new Error('QUERYROOM_ENGINE_MODE must be local or external.');
  return mode;
}
export async function setting(name,env=process.env) {
  if(env[`${name}_FILE`]) return (await fs.readFile(env[`${name}_FILE`],'utf8')).trim();
  return env[name];
}
function port(value,fallback) {
  const number=Number(value || fallback);
  if(!Number.isInteger(number)||number<1||number>65535) throw new Error('Database ports must be between 1 and 65535.');
  return number;
}
async function tls(prefix,env) {
  const enabled=env[`${prefix}_SSL`];
  if(enabled && !['true','false'].includes(enabled)) throw new Error(`${prefix}_SSL must be true or false.`);
  if(enabled!=='true') return undefined;
  const ca=await setting(`${prefix}_SSL_CA`,env);
  return {rejectUnauthorized:true,...(ca?{ca}: {})};
}
export async function externalEngineConfig(env=process.env) {
  const mysqlPassword=await setting('MYSQL_PASSWORD',env),pgPassword=await setting('POSTGRES_PASSWORD',env);
  for(const [key,value] of Object.entries({MYSQL_HOST:env.MYSQL_HOST,MYSQL_USER:env.MYSQL_USER,MYSQL_PASSWORD:mysqlPassword,POSTGRES_HOST:env.POSTGRES_HOST,POSTGRES_USER:env.POSTGRES_USER,POSTGRES_PASSWORD:pgPassword,POSTGRES_DB:env.POSTGRES_DB})) {
    if(!value) throw new Error(`Set ${key} for external databases.`);
  }
  return {
    mysql:{host:env.MYSQL_HOST,port:port(env.MYSQL_PORT,3306),user:env.MYSQL_USER,password:mysqlPassword,ssl:await tls('MYSQL',env),connectTimeout:5000,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true,multipleStatements:false},
    postgresql:{host:env.POSTGRES_HOST,port:port(env.POSTGRES_PORT,5432),user:env.POSTGRES_USER,password:pgPassword,database:env.POSTGRES_DB,ssl:await tls('POSTGRES',env),connectionTimeoutMillis:5000},
  };
}
