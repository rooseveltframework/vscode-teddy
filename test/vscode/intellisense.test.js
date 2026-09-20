const assert = require('node:assert/strict')
const { test, suite } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const { completionLabels, hoverText } = require('./editor.js')

const REPO = path.join(__dirname, '..', '..')
const data = JSON.parse(fs.readFileSync(path.join(REPO, 'html-data/teddy.html-data.json'), 'utf8'))

const textOf = entry => typeof entry.description === 'string' ? entry.description : entry.description.value

// Driven by the custom data file itself, so a tag added there without working
// intellisense fails rather than going unnoticed.

suite('intellisense', () => {
  suite('every teddy tag is offered as a completion', () => {
    for (const tag of data.tags) {
      test(`<${tag.name}>`, async () => {
        const labels = await completionLabels(`<${tag.name}`, tag.name.length + 1)
        assert.ok(labels.includes(tag.name), `<${tag.name}> is not offered; saw ${JSON.stringify(labels.slice(0, 12))}`)
      })
    }
  })

  suite('every teddy tag documents itself on hover', () => {
    for (const tag of data.tags) {
      test(`<${tag.name}>`, async () => {
        const text = await hoverText(`<${tag.name}></${tag.name}>`, 2)
        assert.notEqual(text, '', `no hover documentation for <${tag.name}>`)
        // the first sentence of the custom data description should reach the hover
        const opening = textOf(tag).split(/[.\n]/)[0].replace(/[`*]/g, '').trim()
        assert.ok(
          text.replace(/[`*]/g, '').includes(opening),
          `hover for <${tag.name}> does not show its description; got ${JSON.stringify(text.slice(0, 120))}`
        )
      })
    }
  })

  suite('every tag attribute is offered on its own tag', () => {
    for (const tag of data.tags.filter(entry => entry.attributes?.length)) {
      test(`<${tag.name}> offers ${tag.attributes.map(a => a.name).join(', ')}`, async () => {
        const typed = `<${tag.name} `
        const labels = await completionLabels(typed, typed.length)
        for (const attribute of tag.attributes) {
          assert.ok(labels.includes(attribute.name),
            `<${tag.name}> is missing ${attribute.name}; saw ${JSON.stringify(labels.slice(0, 20))}`)
        }
      })
    }
  })

  suite('every value an attribute names is offered inside that attribute', () => {
    for (const tag of data.tags.filter(entry => entry.attributes?.length)) {
      for (const attribute of tag.attributes.filter(entry => entry.values?.length)) {
        test(`<${tag.name} ${attribute.name}> offers ${attribute.values.map(value => value.name).join(', ')}`, async () => {
          const typed = `<${tag.name} ${attribute.name}="`
          const labels = await completionLabels(typed, typed.length)
          for (const value of attribute.values) {
            assert.ok(labels.includes(value.name),
              `<${tag.name} ${attribute.name}> is missing ${value.name}; saw ${JSON.stringify(labels.slice(0, 20))}`)
          }
        })
      }
    }
  })

  suite('every global attribute is offered on an unrelated element', () => {
    for (const attribute of data.globalAttributes) {
      test(attribute.name, async () => {
        const labels = await completionLabels('<div ', 5)
        assert.ok(labels.includes(attribute.name),
          `${attribute.name} is not offered on <div>; saw ${JSON.stringify(labels.slice(0, 20))}`)
      })
    }
  })

  suite('teddy tags do not displace built-in html tags', () => {
    test('<input> is still offered alongside <if>', async () => {
      const labels = await completionLabels('<i', 2)
      assert.ok(labels.includes('if'), 'teddy <if> is missing')
      assert.ok(labels.includes('input'), 'built-in <input> is missing')
    })

    test('<select> still offers its own attributes', async () => {
      const labels = await completionLabels('<select ', 8)
      assert.ok(labels.includes('multiple'), 'built-in select attributes are missing')
      assert.ok(labels.includes('selected-value'), 'teddy selected-value is missing')
    })
  })
})
