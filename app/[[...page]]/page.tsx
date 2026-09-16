'use client';
import dynamic from 'next/dynamic';
const Workspace = dynamic(() => import('../../src/main'), {ssr: false, loading: () => <div className="app-loading">Opening Queryroom…</div>});
export default function Page() { return <Workspace/>; }
