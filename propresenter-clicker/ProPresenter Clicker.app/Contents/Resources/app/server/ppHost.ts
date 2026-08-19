// Resolves the ProPresenter host from PROPRESENTER_HOST.
//
// "localhost" means "the same machine" — but inside a Docker container that
// would point at the container itself, not the host running ProPresenter. When
// running in a container (RUNNING_IN_DOCKER=true, set in the Dockerfile) we
// rewrite localhost/127.0.0.1 to host.docker.internal, which Docker maps back
// to the host machine. Any other value (e.g. a LAN IP for PP on another box)
// is used unchanged. This lets a single PROPRESENTER_HOST work in both contexts.
export function resolvePpHost(): string {
  const host = process.env.PROPRESENTER_HOST || "localhost";
  const inDocker = process.env.RUNNING_IN_DOCKER === "true";
  if (inDocker && (host === "localhost" || host === "127.0.0.1")) {
    return "host.docker.internal";
  }
  return host;
}
