import { redirect } from 'next/navigation';

// Root just sends visitors to the report form for convenience.
export default function Home() {
  redirect('/weekly-report');
}
