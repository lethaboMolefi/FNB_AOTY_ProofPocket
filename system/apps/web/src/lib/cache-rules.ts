/**
 * API reads the service worker may cache: the signed-in founder's own data only.
 * Never documents, proofs of payment, files, payment pages or other users' data.
 */
export const CACHEABLE_API = /^\/api\/v1\/(me|founder\/(?!.*(files|documents|proofs|download))[\w/-]+)$/;
