import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { postgres, type Database, type Sql } from '../src/lib/server/database.ts';
export async function testDatabase():Promise<Database> {
  if(process.env.TEST_DATABASE_URL) {
    const schema=`test_${randomUUID().replaceAll('-','')}`;
    const control=postgres(process.env.TEST_DATABASE_URL);
    await control.exec(`CREATE SCHEMA ${schema}`);
    const db=postgres(process.env.TEST_DATABASE_URL,`-c search_path=${schema}`);
    return {...db,close:async()=>{await db.close();await control.exec(`DROP SCHEMA ${schema} CASCADE`);await control.close();}};
  }
  const pg=new PGlite();
  const adapt=(client:Pick<PGlite,'query'|'exec'>):Sql=>({query:(q,v)=>client.query(q,v),exec:q=>client.exec(q)});
  return {...adapt(pg),transaction:fn=>pg.transaction(tx=>fn(adapt(tx))),close:()=>pg.close()};
}
