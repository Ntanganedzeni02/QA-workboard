import './globals.css';
export const metadata = { title: 'PAAQ · Personal workboard', description: 'Your work, releases and manual testing in one place.' };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body>{children}</body></html>; }
