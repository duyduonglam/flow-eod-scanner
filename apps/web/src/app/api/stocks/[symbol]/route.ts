import { NextResponse } from 'next/server';
import { demoRows } from '@/lib/demo-data';
export async function GET(_:Request,{params}:{params:Promise<{symbol:string}>}){const {symbol}=await params;const row=demoRows.find(x=>x.symbol===symbol.toUpperCase());return row?NextResponse.json(row):NextResponse.json({error:'not found'},{status:404})}
