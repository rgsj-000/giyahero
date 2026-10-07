import Link from "next/link";
export default function MobileCallback() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">Return to GiyaHero</h1>
      <p className="mt-4">
        Open your installed GiyaHero app to finish signing in. If you confirmed
        your email on another device, you can sign in with your password in the
        app.
      </p>
      <p className="mt-4">
        If the app did not open automatically, check that it is installed and
        that your phone allows GiyaHero to open supported links.
      </p>
      <Link className="mt-6 inline-block underline" href="/login">
        Sign in to the website
      </Link>
    </main>
  );
}
