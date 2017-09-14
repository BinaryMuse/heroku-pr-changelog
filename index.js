require('dotenv-safe').load()

const path = require('path')

const express = require('express')
const changelog = require('pr-changelog')
const {spawn} = require('child_process')

const app = express()

const prChangelogPath = path.join(__dirname, 'node_modules', '.bin', 'pr-changelog')
app.get('/:owner/:repo/:start/:end', (req, res) => {
  const {owner, repo, start, end} = req.params
  const child = spawn(prChangelogPath, ['-v', '-P', '-r', `${owner}/${repo}`, `${start}...${end}`], {
    env: Object.assign({}, process.env, {
      GITHUB_ACCESS_TOKEN: req.query.token || process.env.GITHUB_ACCESS_TOKEN
    })
  })

  let exited = false
  let stdout = ""
  let stderr = ""
  child.on('error', () => {
    if (exited) return
    exited = true

    res.status(500).json({error: 'An unknown error occurred'})
  })

  child.on('exit', () => {
    if (exited) return
    exited = true

    res.status(200).json({stdout, stderr})
  })

  child.stdout.on('data', (data) => {
    stdout += data.toString()
  })

  child.stderr.on('data', (data) => {
    stderr += data.toString()
  })
})

const port = process.env.PORT || 3001
app.listen(port, () => {
  console.log(`Listening on ${port}`)
})
