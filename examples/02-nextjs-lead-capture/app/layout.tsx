export const metadata = {
  title: 'Acme | Talk to sales',
  description: 'Conversational lead capture powered by Swfte ChatFlows.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
