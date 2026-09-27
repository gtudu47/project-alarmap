# Versions identiques aux anciennes images officielles ; modules vérifiés par Go sumdb.
FROM golang:1.26-bookworm@sha256:a688600ca24f8a4d3ca77f95b0dd40704a9fc787c826660eb7ba0b641b8b175d AS server-build
ENV CGO_ENABLED=0
RUN go install -trimpath github.com/minio/minio@RELEASE.2025-09-07T16-13-09Z

FROM golang:1.26-bookworm@sha256:a688600ca24f8a4d3ca77f95b0dd40704a9fc787c826660eb7ba0b641b8b175d AS client-build
ENV CGO_ENABLED=0
RUN go install -trimpath github.com/minio/mc@RELEASE.2025-08-13T08-35-41Z

FROM debian:bookworm-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251 AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

FROM runtime AS server
LABEL org.opencontainers.image.source="https://github.com/minio/minio" org.opencontainers.image.licenses="AGPL-3.0-only"
COPY --from=server-build /go/pkg/mod/github.com/minio/minio@*/LICENSE /usr/share/licenses/minio/LICENSE
COPY --from=server-build /go/bin/minio /usr/local/bin/minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]

FROM runtime AS client
LABEL org.opencontainers.image.source="https://github.com/minio/mc" org.opencontainers.image.licenses="AGPL-3.0-only"
COPY --from=client-build /go/pkg/mod/github.com/minio/mc@*/LICENSE /usr/share/licenses/mc/LICENSE
COPY --from=client-build /go/bin/mc /usr/local/bin/mc
ENTRYPOINT ["mc"]
