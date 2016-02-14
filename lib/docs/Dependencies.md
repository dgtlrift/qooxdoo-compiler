#Dependencies

The main task of QxCompiler (and generate.py) is to read the code and figure out the correct load order for the javascript
files.  Once you have a parser and can recognise symbol references it is quite straightforward to determine what classes
are required, but the order in which they must be loaded is more complex because if you simply assume that any reference 
means the class referred must be loaded first then you quickly find a recursive dependency order that cannot be satisfied.

Consider this example:

```javascript
qx.Class.define("mypackage.MyClassA", {
    extend: qx.core.Object,
    implement: [ qx.data.IListData ],
    
    members: {
        someMethod: function() {
            new qx.data.Array();
        }
    },
    
    statics: {
        IS_MSIE: qx.core.Environment.get("engine.name") == "mshtml"
    }
});
```

In this example, qx.data.Array is required *at runtime* but is not required to load the class - the load dependencies are
any class referred to directly by the object passed to qx.Class.define.  Note the call to qx.core.Environment.get - it
uses the "engine.name" check which is implemented by qx.bom.client.Engine, so there is another load time dependency there.

##Class .defer() method
All of the above can be done with fairly simple static analysis, but the is a further difficulty - each class definition
can have a defer() method which is called immediately after the class has been defined; because the code in defer() can
do anything, it can add significant dependencies which can only be determined by figuring out what the runtime stack trace 
would be.  

For example, qx.ui.form.AbstractField.defer() calls qx.ui.style.Stylesheet.getInstance(), the constructor for which calls 
qx.bom.Stylesheet.createElement(); that function in turns relies on the "html.stylesheet.createstylesheet" environment check 
which is implemented by qx.bom.client.Stylesheet.  So technically, qx.ui.form.AbstractField has a load time dependency on 
qx.bom.client.Stylesheet but this can only be identified by tracking the dependencies on a per function basis, 
recursively scanning code and statically determining what the runtime dependencies *would* be.

I guess that this is something that generate.py does, but it makes dependency analysis hugely more complex and is quite
fragile - it would be very easy for the author of qx.bom.Stylesheet to make a minor change in the constructor 
and introduce a recursive, unresolvable dependency.
 
However this is only an issue for loading the class, if we can avoid calling defer() until all the classes have been loaded
then the problem disappears; this is the solution used by QxCompiler in almost all cases.  It's important to note that
a class is not fully defined until it's defer method has been called, so the exception is that any class methods which 
are called when defining a class (such as qx.core.Environment.get()) must make sure that the defer() method has alrfeady been
called for that class.  In the above example, this means that mypackage.MyClassA must have q.core.Environment loaded *and* it's
defer method called before the call to qx.Class.define("mypackage.MyClassA"...).


##Runtime meta data
The meta data about a class, it's dependencies, unresolved symbols, etc are available as a static object $$dbClassInfo for 
each class, EG mypackage.MyClassA.$$dbClassInfo.  Much of this will probably be stripped out in future build targets.