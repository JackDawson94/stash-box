# stash-box

[![Discord](https://img.shields.io/discord/559159668438728723.svg?logo=discord)](https://discord.gg/2TsNFKt)

**stash-box is Stash App's own OpenSource video indexing and Perceptual Hashing MetaData API server for porn.**

The intent of stash-box is to provide a collaborative, crowd-sourced database of porn metadata, in the same way as [MusicBrainz](https://musicbrainz.org/) does for music. The submission and editing of metadata is expected to follow the same principle as that of the MusicBrainz database. [See here](https://musicbrainz.org/doc/Editing_FAQ) for how MusicBrainz does it.  Installing this software will create a blank stash-box database that you can populate yourself.

The graphql playground can be accessed at `host:port/playground`. The graphql interface is at `host:port/graphql`.

**Note: If you are a [Stash](https://github.com/stashapp/stash) user, you do not need to install stash-box.  The Stash community has a server with many titles from which you can pull data. You can get the login information from the [#stashdb-invites](https://discord.com/channels/559159668438728723/935614155107471442) channel on our [Discord server](https://discord.gg/2TsNFKt).**

# Docker install

A docker-compose file for production deployment can be found [here](docker/production/docker-compose.yml). Traefik can be omitted if you don't need a reverse proxy.

Alternatively, if postgresql is already available, stash-box can be installed on its own from [dockerhub](https://hub.docker.com/r/stashapp/stash-box).

# Bare-metal Install

Stash-box supports macOS, Windows, and Linux.  

Releases TODO

## Initial setup

Before building the binary the frontend project needs to be built.
* Run `make pre-ui` to install frontend dependencies.
* Run `make ui` to build the frontend bundles.
* Run `make build` to build the binary.

Stash-box requires access to a postgres database server. When stash-box is first run, or when it cannot find a configuration file (defaulting to `stash-box-config.yml` in the current working directory), then it generates a new configuration file with a default postgres connection string (`postgres@localhost/stash-box?sslmode=disable`). It prints a message indicating that the configuration file is generated, and allows you to adjust the default connection string as needed.

The database must be created and available. If the postgres user is not a superuser, `CREATE EXTENSION pg_trgm; CREATE EXTENSION pgcrypto;` needs to be run by a superuser before rerunning stash-box, otherwise you will get a migration error. The schema will be created within the database if it is not already present.

The `sslmode` parameter is documented in the [pq documentation](https://godoc.org/github.com/lib/pq). Use `sslmode=disable` to not use SSL for the database connection. The default value is `require`.

After ensuring the database connection string is correct and the database server is available, the stash-box executable may be rerun.

The second time that stash-box is run, stash-box will run the schema migrations to create the required tables. It will also generate a `root` user with a random password and an API key. These credentials are printed once to stdout and are not logged. The root user will be regenerated on startup if it does not exist, so a new root user may be created by deleting the root user row from the database and restarting stash-box.

## CLI

Stash-box provides some command line options.  See what is currently available by running `stash-box --help`.

For example, to run stash locally on port 80 run it like this (OSX / Linux) `stash-box --host 127.0.0.1 --port 80`.

## Configuration

Stash-box generates a configuration file `stash-box-config.yml` in the current working directory when it is first started up. This configuration file is generated with the following defaults:
- running on `0.0.0.0` port `9998`

The graphql playground and cross-domain cookies can be disabled by setting `is_production: true`.

### API keys and authorisation

A user may be authenticated in one of two ways. Session-based management is possible by logging in via `/login`, passing form values for `username` and `password` in plain text. This sets a cookie which is required for subsequent requests. The session can be ended with a request to `/logout`.

The alternative is to use the user's api key. For this, the `ApiKey` header must be set to the user's api key value.

### Configuration keys

| Key | Default | Description |
|-----|---------|-------------|
| `title` | `Stash-Box` | Title of the instance, used in the page title. |
| `require_invite` | `true` | If true, users are required to enter an invite key, generated by existing users to create a new account. |
| `require_activation` | `true` | If true, users are required to verify their email address before creating an account. |
| `activation_expiry` | `7200` (2 hours) | The time - in seconds - after which an activation key (emailed to the user for email verification or password reset purposes) expires. |
| `email_cooldown` | `300` (5 minutes) | The time - in seconds - that a user must wait before submitting an activation or reset password request for a specific email address. |
| `default_user_roles` | `READ`, `VOTE`, `EDIT` | The roles assigned to new users when registering. This field must be expressed as a yaml array. |
| `vote_promotion_threshold` | (none) | Number of approved edits before a user automatically has the `VOTE` role assigned. Leave empty to disable. |
| `vote_application_threshold` | `3` | Number of same votes required for immediate application of an edit. Set to zero to disable automatic application. |
| `voting_period` | `345600` | Time, in seconds, before a voting period is closed. |
| `min_destructive_voting_period` | `172800` | Minimum time, in seconds, that needs to pass before a destructive edit can be immediately applied with sufficient positive votes. |
| `vote_cron_interval` | `5m` | Time between runs to close edits whose voting periods have ended. |
| `email_host` | (none) | Address of the SMTP server. Required to send emails for activation and recovery purposes. |
| `email_port` | `25` | Port of the SMTP server. |
| `email_user` | (none) | Username for the SMTP server. Optional. |
| `email_password` | (none) | Password for the SMTP server. Optional. |
| `email_from` | (none) | Email address from which to send emails. |
| `host_url` | (none) | Base URL for the server. Used when sending emails. Should be in the form of `https://hostname.com`. |
| `image_location` | (none) | Path to store images, for local image storage. An error will be displayed if this is not set when creating non-URL images. |
| `image_backend` | (`file`) | Storage solution for images. Can be set to either `file` or `s3`. |
| `userLogFile` | (none) | Path to the user log file, which logs user operations. If not set, then these will be output to stderr. |
| `s3.endpoint` | (none) | Hostname to s3 endpoint used for image storage. |
| `s3.base_url` | (none) | Base URL to access images in S3. Should be in the form of `https://hostname.com`. |
| `s3.bucket` | (none) | Name of S3 bucket used to store images. |
| `s3.access_key` | (none) | Access key used for authentication. |
| `s3.secret ` | (none) | Secret Access key used for authentication. |
| `s3.max_dimension` | (none) | If set, a resized copy will be created for any image whose dimensions exceed this number. This copy will be served in place of the original.
| `phash_distance` | 0 | Determines what binary distance is considered a match when querying with a phash fingeprint. Using more than 8 is not recommended and may lead to large amounts of false positives. **Note**: The [pg-spgist_hamming extension](#phash-distance-matching) must be installed to use distance matching, otherwise you will get errors. |
| `favicon_path` | (none) | Location where favicons for linked sites should be stored. Leave empty to disable. |
| `draft_time_limit` | (24h) | Time, in seconds, before a draft is deleted. |
| `profiler_port` | 0 | Port on which to serve pprof output. Omit to disable entirely. |
| `postgres.max_open_conns` | (0) | Maximum number of concurrent open connections to the database. |
| `postgres.max_idle_conns` | (0) | Maximum number of concurrent idle database connections. |
| `postgres.conn_max_lifetime` | (0) | Maximum lifetime in minutes before a connection is released. |

## SSL (HTTPS)

Stash-box supports HTTPS with some additional work.  First you must generate a SSL certificate and key combo.  Here is an example using openssl:

`openssl req -x509 -newkey rsa:4096 -sha256 -days 7300 -nodes -keyout stash-box.key -out stash-box.crt -extensions san -config <(echo "[req]"; echo distinguished_name=req; echo "[san]"; echo subjectAltName=DNS:stash-box.server,IP:127.0.0.1) -subj /CN=stash-box.server`

This command would need customizing for your environment.  [This link](https://stackoverflow.com/questions/10175812/how-to-create-a-self-signed-certificate-with-openssl) might be useful.

Once you have a certificate and key file name them `stash-box.crt` and `stash-box.key` and place them in the directory where stash-box is run from. Stash-box detects these and starts up using HTTPS rather than HTTP.

## PHash Distance Matching
Enabling distance matching for phashes requires installation of the [pg-spgist_hamming](https://github.com/fake-name/pg-spgist_hamming) postgres extension. The recommended method is using the [docker image](docker/production/postgres/Dockerfile). Alternatively it can be installed manually by following the build instructions in the pg-spgist_hamming repo.

If the extension is installed after the migrations have been run, migration #14 will have to be run manually to install the extension and add the index. Alternatively the database can be wiped so the migrations will run the next time stash-box is started.

# Development

## Install

* [Go](https://golang.org/dl/), minimum version 1.17.
* [golangci-lint](https://golangci-lint.run/) - Linter aggregator
    * Follow instructions for your platform from [https://golangci-lint.run/usage/install/](https://golangci-lint.run/usage/install/).
    * Run the linters with `make lint`.
* [Yarn](https://yarnpkg.com/en/docs/install) - Yarn package manager

## Commands

* `make generate` - Generate Go GraphQL files. This should be run if the graphql schema has changed.
* `make ui` - Builds the UI.
* `make pre-ui` - Download frontend dependencies
* `make build` - Builds the binary
* `make test` - Runs the unit tests
* `make it` - Runs the unit and integration tests
* `make lint` - Run the linters
* `make fmt` - Formats and aligns whitespace

**Note:** the integration tests run against a temporary sqlite3 database by default. They can be run against a postgres server by setting the environment variable `POSTGRES_DB` to the postgres connection string. For example: `postgres@localhost/stash-box-test?sslmode=disable`. **Be aware that the integration tests drop all tables before and after the tests.**

## Frontend development

To run the frontend in development mode, run `yarn start` from the frontend directory.

When developing the API key can be set in `frontend/.env.development.local` to avoid having to log in.  
When `is_production` is enabled on the server this is the only way to authorize in the frontend development environment. If the server uses https or runs on a custom port, this also needs to be configured in `.env.development.local`.  
See `frontend/.env.development.local.shadow` for examples.

## Building a release

1. Run `make generate` to create generated files, if they have been changed.
2. Run `make ui build` to build the executable for your current platform.

# FAQ

> I have a question not answered here.

Join the [Discord server](https://discord.gg/2TsNFKt).
