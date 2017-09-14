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
    console.log('stdout: ' + data.toString())
    stdout += data.toString()
  })

  child.stderr.on('data', (data) => {
    console.log('stderr: ' + data.toString())
    stderr += data.toString()
  })
}

const prChangelogPath = path.join(__dirname, 'node_modules', '.bin', 'pr-changelog')
app.get('/:owner/:repo/:start/:end', (req, res) => {
  const {owner, repo, start, end} = req.params
  getChangelog(req.token || process.env.GITHUB_ACCESS_TOKEN, owner, repo, start, end, (err, result) => {
    if (err) {
      res.status(500).json({error: err.message})
    } else {
      const {stdout, stderr} = result
      res.json({stdout, stderr})
    }
  })
})

const endpoint = crpc.endpoint(app, 'pr-changelog', '/_chatops')
endpoint.method('query', {
  help: 'query <owner>/<repo> <start> <end>',
  regex: 'query (?<owner>.+)/(?<repo>.+) (?<start>.+) (?<end>.+)',
  params: ['owner', 'repo', 'start', 'end']
}, ({params}, respond) => {
  const {owner, repo, start, end} = params

  console.log(`Fetching PR changelog for ${owner}/${repo}#${start}...${end}`)
  getChangelog(process.env.GITHUB_ACCESS_TOKEN, owner, repo, start, end, (err, result) => {
    console.log('Fetched')
    if (err) {
      try {
        console.log("Responding with error", err)
        respond('Error querying that PR changelog:\n\n' + stderr)
      } catch (e) {
        console.error(e)
      }
    } else {
      try {
        const {stdout, stderr} = result
        console.log("Respinding with data", stdout, stderr)
        respond(`${stdout}\n\n========================\n\n${stderr}`, {
          title: `PR Changelog for ${owner}/${repo}#${start}...${end}`,
          title_link: `https://github.com/${owner}/${repo}/compare/${start}...${end}`,
          color: '0000ff'
        })
      } catch (e) {
        console.error(e)
      }
    }
  })
})

const port = process.env.PORT || 3001
app.listen(port, () => {
  console.log(`Listening on ${port}`)
})
