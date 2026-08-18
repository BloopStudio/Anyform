#!/bin/bash
set -euo pipefail

# N'installe la clé de signature commit que dans les sessions Claude Code sur le web/cloud
# (voir $CLAUDE_CODE_REMOTE) — inutile et indésirable pour quelqu'un qui utilise Claude Code
# en local avec sa propre config git/SSH.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if ! command -v ssh-keygen >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq openssh-client || true
fi

mkdir -p ~/.ssh

echo "LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0KYjNCbGJuTnphQzFyWlhrdGRqRUFBQUFBQkc1dmJtVUFBQUFFYm05dVpRQUFBQUFBQUFBQkFBQUFNd0FBQUF0emMyZ3RaVwpReU5UVXhPUUFBQUNEam95bG9malFnWDhpTWZ5QlJPWGgycm9vMktMbE5ESVpLZWtudVdKaDlKUUFBQUtpaURlWTdvZzNtCk93QUFBQXR6YzJndFpXUXlOVFV4T1FBQUFDRGpveWxvZmpRZ1g4aU1meUJST1hoMnJvbzJLTGxORElaS2VrbnVXSmg5SlEKQUFBRUNRLzc0VEpzRk9nbDB5N04vdnhNUU03N2JTejNzbHpvczE4RWk2VzVTTFB1T2pLV2grTkNCZnlJeC9JRkU1ZUhhdQppallvdVUwTWhrcDZTZTVZbUgwbEFBQUFJMVJvWlVSRlRVOU9OemdnS0VGdWVXWnZjbTBnWTI5dGJXbDBJSE5wWjI1cGJtCmNwQVFJPQotLS0tLUVORCBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0K" | base64 -d > ~/.ssh/anyform_signing_key
chmod 600 ~/.ssh/anyform_signing_key

cat > ~/.ssh/anyform_signing_key.pub <<'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOOjKWh+NCBfyIx/IFE5eHauijYouU0Mhkp6Se5YmH0l TheDEMON78 (Anyform commit signing)
EOF

git config --global gpg.format ssh
git config --global gpg.ssh.program ssh-keygen
git config --global user.signingkey ~/.ssh/anyform_signing_key.pub
git config --global commit.gpgsign true
git config --global user.email "90475756+TheDEMON78@users.noreply.github.com"
