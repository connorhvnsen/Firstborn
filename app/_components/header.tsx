import Link from "next/link";
import { Button } from "@/components/ui/button";

type Props = {
  signedIn: boolean;
  email: string | null;
  credits: number;
  unlimited?: boolean;
};

export function Header({ signedIn, email, credits, unlimited }: Props) {
  return (
    <div className="sticky top-0 z-50 border-b border-stone-200 bg-white/60 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-8 px-6 py-4 text-xs">
        {/* Left: brand + nav */}
        <div className="flex items-center gap-8">
          {signedIn && (
            <nav className="flex items-center gap-7">
              <Link
                href="/"
                className="text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
              >
                Generator
              </Link>
              <Link
                href="/history"
                className="text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
              >
                History
              </Link>
            </nav>
          )}
        </div>

        {/* Right: account */}
        {signedIn ? (
          <div className="flex items-center gap-6">
            <span className="text-stone-500">
              {unlimited ? (
                <>
                  <span className="font-medium text-stone-800">∞</span>{" "}
                  generations
                </>
              ) : (
                <>
                  <span className="font-medium text-stone-800">{credits}</span>{" "}
                  {credits === 1 ? "generation" : "generations"} left
                </>
              )}
            </span>
            <span className="hidden text-stone-400 sm:inline">{email}</span>
            <form action="/auth/signout" method="post">
              <Button
                type="submit"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs font-normal text-stone-500 underline-offset-4 hover:text-stone-900 hover:no-underline"
              >
                Sign out
              </Button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
