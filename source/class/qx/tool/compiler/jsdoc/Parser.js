/* ************************************************************************
 *
 *    qooxdoo-compiler - node.js based replacement for the Qooxdoo python
 *    toolchain
 *
 *    https://github.com/qooxdoo/qooxdoo-compiler
 *
 *    Copyright:
 *      2011-2017 Zenesis Limited, http://www.zenesis.com
 *
 *    License:
 *      MIT: https://opensource.org/licenses/MIT
 *
 *      This software is provided under the same licensing terms as Qooxdoo,
 *      please see the LICENSE file in the Qooxdoo project's top-level directory
 *      for details.
 *
 *    Authors:
 *      * John Spackman (john.spackman@zenesis.com, @johnspackman)
 *
 * *********************************************************************** */

require("@qooxdoo/framework");
require("./ChildControlParser");
require("./ParamParser");
require("./ReturnParser");
require("./ThrowsParser");

const showdown = require("showdown");

/**
 * JSDoc Parser
 */
qx.Class.define("qx.tool.compiler.jsdoc.Parser", {
  extend: qx.core.Object,

  statics: {
    /**
     * Parses a JSDoc comment, returns an object where the keys are the name of the JSDoc (eg "@description")
     * and the value are an array of objects, one for each entry that was found.  The individual entries
     * consist of the name, the body of the JSDoc entry, and optional, key-specific parsed data (where supported)
     */
    parseComment: function(comment) {
      var current = { name: "@description", body: "" };
      var cmds = [ current ];

      // special handling for code section
      comment = comment.replace(/@([^@}\n\r]*)@/g, "<code>$1</code>");
      // Strip optional leading * 
      comment = comment.replace(/^\s*\*/mg, "");
      // special handling for as markdown lists - * in qooxdoo
      comment = comment.replace(/^\s*\*/mg, "*");
      comment = comment.replace(/^\s*\*\*\*\*/mg, "\t\t\t*");
      comment = comment.replace(/^\s*\*\*\*/mg, "\t\t*");
      comment = comment.replace(/^\s*\*\*/mg, "\t*");
      
      comment = comment.split("\n");
      comment.forEach(function(line) {
        line = line.trimRight();
        if (!line) {
          return;
        }
        
        // Strip trailing single line comment
        let m = line.match(/(^.*)([^:]\/\/.*)$/);
        if (m) {
          line = m[1].trimRight();
        }
        
        // Look for command at the beginning of the line
        m = line.match(/^\s*(\@[a-zA-Z0-9_]+)(.*)$/);
        if (!m) { // Clean starting * as markdown lists
          if (current.body.length) {
            current.body += "\n";
          }
          current.body += line;
          return;
        }

        var name = m[1];
        var body = m[2];

        // Patch common command names
        if (name == "@returns") {
          name = "@return";
        }
        if (name == "@throw") {
          name = "@throws";
        }

        // store it
        current = { name: name, body: body };
        cmds.push(current);
      });
      var result = {};
      let converter = new showdown.Converter();
      cmds.forEach(function(cmd) {
        if (cmd.name === "@description") {
          try {
            cmd.body = converter.makeHtml(cmd.body);
          } catch (e) {
            qx.tool.compiler.Console.error(`Markdown conversion error: "${e.message}" found in \n${cmd.body.trim()}`);
          }
        } else {
          // If the body is surrounded by parameters, remove them
          let m = cmd.body.match(/^\s*\(([\s\S]*)\)\s*$/m);
          if (m) {
            cmd.body = m[1];
          }
          cmd.body = cmd.body.trim();
        }
        if (result[cmd.name]) {
          result[cmd.name].push(cmd);
        } else {
          result[cmd.name] = [ cmd ];
        }
      });
      return result;
    },

    parseJsDoc: function(jsdoc, classname, analyser) {
      for (var key in jsdoc) {
        var parser = this.__PARSERS[key];
        if (parser) {
          jsdoc[key].forEach(pdoc => parser.parseCommand(pdoc, classname, analyser));
        }
      }
    },

    __PARSERS: {
      "@param": new qx.tool.compiler.jsdoc.ParamParser(),
      "@return": new qx.tool.compiler.jsdoc.ReturnParser(),
      "@throws": new qx.tool.compiler.jsdoc.ThrowsParser(),
      "@throw": new qx.tool.compiler.jsdoc.ThrowsParser(),
      "@childControl": new qx.tool.compiler.jsdoc.ChildControlParser()
    }
  }
});
