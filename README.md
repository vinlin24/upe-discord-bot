# Tera-Byte, the Induction Bot

The Discord bot for [Upsilon Pi Epsilon at UCLA](https://upe.seas.ucla.edu), used to automate some induction-related administration.

## Development Setup

Install dependencies:

```sh
npm install
```

### Local Environment Recovery

To set up the local `.env` file, first copy the template:

```sh
cp .env.example .env
```

Then fill out the environment variables as documented. If in doubt, reach out to a current developer.

### Remote Server SSH

As of now, the remote server is managed by the **Web** committee, so they are your point of contact for login information (user & hostname).

Generate an SSH key pair:

```sh
ssh-keygen -t ed25519
```

For the convenience of automation, don't set a passphrase. Be sure to keep your key safe!

```sh
chmod 600 /path/to/your_new_key
```

Give a **Web** officer your **public key** (the one with the `.pub` extension). You could probably do this yourself with [ssh-copy-id](https://askubuntu.com/a/4833), but best not to undermine the jurisdiction of other committees:

```sh
cat /path/to/your_new_key.pub
# Copy the output and give it to them.
```

If you didn't use [one of the default SSH key names](https://askubuntu.com/a/30792), update your SSH configuration because the scripts do not use `ssh -i`:

```sh
nano ~/.ssh/config
```

Add an entry for the server's hostname and specify your private key `IdentityFile`:

```ini
Host HOSTNAME_HERE
  IdentityFile /path/to/your_new_key
  # Add these too if you're on MacOS:
  AddKeysToAgent yes
  UseKeychain yes
```

If you want to use some [convenience scripts](scripts/) that connect to the remote server, also create a file with the server IP:

```sh
# Replace with server's hostname:
echo -n 'A.B.C.D' > droplet.txt
```

### Google Credentials File

You'll also need the credentials file associated with the Google API service account used in Google Sheets automation.

> [!IMPORTANT]
>
> This file needs to exist at `src/assets/google-credentials.json`.

Either contact a developer for a copy or [create a new service account](https://cloud.google.com/iam/docs/service-accounts-create).

> [!CAUTION]
>
> Also, any sheets used by the bot need to have [access granted to the service account on the Google Sheets side](#google-sheets-automation).

## Running

### Entry Points

There are various scripts defined in [package.json](package.json):

| npm Script | Description                                     | Bot Login? |
| ---------- | ----------------------------------------------- | ---------- |
| `start`    | Execute full build & run pipeline.              | ✅          |
| `dev`      | Interpret TypeScript source directly.           | ✅          |
| `sync`     | Deploy application commands to Discord.         | ❌          |
| `build`    | Compile TypeScript source and bundle assets.    | ❌          |
| `lint`     | Run linter.                                     | ❌          |
| `lint:fix` | Run linter and fix all fixable errors in-place. | ❌          |

### Deployment

If the [environment is set up](#development-setup) correctly, you should be able to deploy to the remote server directly from your local machine using:

```sh
scripts/deploy.sh
```

This approach should probably be deprecated later. The more formal CI process is documented [below](#github-actions).

## Maintenance

### Environment Variables

> [!IMPORTANT]
>
> Notably, as of now, many environment variables are ***seasonal***: they are links, spreadsheet IDs, Discord channel IDs, etc. used for the current induction season and need to be replaced in future seasons.

The `ENV_SPEC` defined in [env.ts](src/env.ts) is the single source of truth for required environment variables (declaration, typing, validation, and documentation all in one place).

The rest of the codebase needs to go through the exported validated `env` object. Accessing `process.env` directly is prohibited and enforced by [the linter](eslint.config.mjs).

Updates to `ENV_SPEC` will automatically propagate to [.env.example](.env.example) via a [pre-commit script](.husky/pre-commit).

> [!CAUTION]
>
> What *isn't* automatic is the updating of the environment file in GitHub Actions. Its [corresponding repository secret must be updated](#github-actions) if the deployed bot is to use a new `.env` file.

### GitHub Actions

Pushes to `main` on GitHub will automatically trigger a [GitHub Actions workflow](.github/workflows/deploy.yml) that checks, builds, and deploys the code to the remote server. It depends on some **repository secrets** to keep sensitive values out of version control.

The **repository secrets** and how to get them are:

- `SSH_PRIVATE_KEY`: SSH private key used to connect to the remote server.
  ```sh
  cat /path/to/your_private_key
  ```
- `SERVER_SSH`: Remote server SSH login, in the format of `user@hostname`. Likely this, but contact **Web** to be sure:
  ```sh
  echo -n "root@$(cat droplet.txt)"
  ```
- `GOOGLE_CREDENTIALS_B64`: Base64 encoding of the [Google credentials file](#google-credentials-file).
  ```sh
  cat src/assets/google-credentials.json | base64
  ```
- `ENV_FILE_B64`: Base64 encoding of the [.env file](#local-environment-recovery).
  ```sh
  cat .env | base64
  ```

Guideline of when changes are needed:

| Repository Secret        | Change When...          | Estimated Frequency     |
| ------------------------ | ----------------------- | ----------------------- |
| `SSH_PRIVATE_KEY`        | Keys change             | ❎ Seldom                |
| `SERVER_SSH`             | Server changes          | ❎ Seldom                |
| `GOOGLE_CREDENTIALS_B64` | Service account changes | ❎ Seldom                |
| `ENV_FILE_B64`           | `.env` file changes     | ⚠️ Seasonal / by feature |

> [!NOTE]
>
> Base64 is used as a way to compact long file content into a single secret value but more importantly to avoid pitfalls involving whitespace or shell meta-characters. The [CI script](.github/workflows/deploy.yml) is responsible for `base64 --decode`ing the content back out.

### Google Sheets Automation

Some Google Sheets spreadsheets needed by the bot are private (shared with UPE officers only). For the bot to access them, you need to give access to its [service account](#google-credentials-file). Click on **Share** and invite the client email associated with the service account.

If access control isn't copied over when setting up for a new induction season, you need to manually redo this every season!
