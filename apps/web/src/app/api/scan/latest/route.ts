import { NextResponse } from 'next/server';
import { demoRows } from '@/lib/demo-data';
import { getSupabase } from '@/lib/supabase';
export async function GET(){
  const db=getSupabase();
  if(!db) return NextResponse.json({market_date:null,data_status:'DEMO',rows:demoRows});
  const {data,error}=await db.from('latest_scan_results').select('*').order('rank',{ascending:true});
  if(error) return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({data_status:'LIVE',rows:data??[]});
}
