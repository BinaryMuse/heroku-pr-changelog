require('dotenv-safe').load()

const path = require('path')
const {spawn} = require('child_process')

const express = require('express')
const changelog = require('pr-changelog')
const crpc = require('hubot-rpc-gen')

const app = express()

function getChangelog(token, owner, repo, start, end, callback) {
  const child = spawn(prChangelogPath, ['-v', '-P', '-r', `${owner}/${repo}`, `${start}...${end}`], {
    env: Object.assign({}, process.env, {
      GITHUB_ACCESS_TOKEN: token
    })
  })

  let exited = false
  let stdout = ""
  let stderr = ""
  child.on('error', () => {
    if (exited) return
    exited = true

    callback(new Error(stderr))
  })

  child.on('exit', () => {
    if (exited) return
    exited = true

    callback(null, {stdout, stderr})
  })

  child.stdout.on('data', (data) => {
    stdout += data.toString()
  })

  child.stderr.on('data', (data) => {
    stderr += data.toString()
  })
}

const prChangelogPath = path.join(__dirname, 'node_modules', '.bin', 'pr-changelog')
app.get('/:owner/:repo/:start/:end', (req, res) => {
  const {owner, repo, start, end} = req.params
  getChangelog(req.token || process.env.GITHUB_ACCESS_TOKEN, owner, repo, start, end, (err, {stdout, stderr}) => {
    if (err) {
      res.status(500).json({error: err.message})
    } else {
      res.json({stdout, stderr})
    }
  })
})

const endpoint = crpc.endpoint(app, 'pr-changelog', '/_chatops')
endpoint.method('query', {
  help: 'query <owner>/<repo> <start> <end>',
  regex: 'query (?<owner>.+)/(?<repo>.+) (?<start>.+) (?<end>.+)',
  params: ['owner', 'repo', 'start', 'end']
}, ({user, method, params, room_id}, respond) => {
  const {owner, repo, start, end} = params

  getChangelog(process.env.GITHUB_ACCESS_TOKEN, owner, repo, start, end, (err, {stdout, stderr}) => {
    if (err) {
      respond(stderr, {
        title: 'Error querying that PR changelog',
        color: 'ff0000'
      })
    } else {
      respond(stdout, {
        title: `PR Changelog for ${owner}/${repo}#${start}...${end}`,
        title_link: `https://github.com/${owner}/${repo}/compare/${start}...${end}`,
        color: '0000ff'
      })
    }
  })
})

const port = process.env.PORT || 3001
app.listen(port, () => {
  console.log(`Listening on ${port}`)
})
