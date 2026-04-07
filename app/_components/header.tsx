import Link from "next/link";

type Props = {
  signedIn: boolean;
  email: string | null;
  credits: number;
};

export function Header({ signedIn, email, credits }: Props) {
  return (
    <div className="border-b border-stone-200 bg-white/60 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3 text-xs">
        <Link href="/" className="text-stone-400 hover:text-stone-600">
          初
        </Link>
        {signedIn ? (
          <div className="flex items-center gap-4">
            <span className="text-stone-500">
              <span className="font-medium text-stone-800">{credits}</span>{" "}
              {credits === 1 ? "generation" : "generations"} left
            </span>
            <span className="hidden text-stone-300 sm:inline">·</span>
            <Link
              href="/history"
              className="text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
            >
              History
            </Link>
            <span className="hidden text-stone-300 sm:inline">·</span>
            <span className="hidden text-stone-500 sm:inline">{email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
