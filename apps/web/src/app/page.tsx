import { Homepage } from '@/components/homepage';
import { getSampleHomepage } from '@/lib/api/homepage';

export default function Home() {
  return <Homepage data={getSampleHomepage()} />;
}
