/** An error the API reports to the client as { error: { code, message } }. */
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const unauthenticated = () => new AppError(401, "unauthenticated", "Sign in to continue.");
export const forbidden = (message = "You don't have access to this.") => new AppError(403, "forbidden", message);
export const notFound = (what = "That") => new AppError(404, "not_found", `${what} wasn't found.`);
export const badRequest = (code: string, message: string) => new AppError(400, code, message);
