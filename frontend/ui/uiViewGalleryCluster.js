class UIViewGalleryCluster extends UIElement
{
    static __LOG__                  = true;

    // ----------------------------------------------------
    constructor(opts={})
    {
        super("div", opts);
        this.id('view-gallery-cluster').addClass('view');

        this.bFlex = true;
    }

    // ----------------------------------------------------
    create()
    {

    }

    // ----------------------------------------------------
    async load(opts={})
    {
        let result = await call('clustering/plot_dendrogram', {'session_id':__UI_PARAM_EXPLORER__.session_id});

        if (result.status == 'ok')
        {

            let chart = Tree(result.tree, 
            {
                label: d => d.name,
                title: (d, n) => `${n.ancestors().reverse().map(d => d.data.name).join(".")}`, // hover text
                tree: d3.cluster,
                width: window.screen.width
            });

            this.element.append( chart );
        }
    }

    // ----------------------------------------------------
    updateLayout()
    {
    }
}


function Tree(data, { // data is either tabular (array of objects) or hierarchy (nested objects)
  path, // as an alternative to id and parentId, returns an array identifier, imputing internal nodes
  id = Array.isArray(data) ? d => d.id : null, // if tabular data, given a d in data, returns a unique identifier (string)
  parentId = Array.isArray(data) ? d => d.parentId : null, // if tabular data, given a node d, returns its parent’s identifier
  children, // if hierarchical data, given a d in data, returns its children
  tree = d3.tree, // layout algorithm (typically d3.tree or d3.cluster)
  sort, // how to sort nodes prior to layout (e.g., (a, b) => d3.descending(a.height, b.height))
  label, // given a node d, returns the display name
  title, // given a node d, returns its hover text
  link, // given a node d, its link (if any)
  linkTarget = "_blank", // the target attribute for links (if any)
  width = 640, // outer width, in pixels
  height, // outer height, in pixels
  r = 3, // radius of nodes
  padding = 1, // horizontal padding for first and last column
  fill = "#999", // fill for nodes
  fillOpacity, // fill opacity for nodes
  stroke = "#555", // stroke for links
  strokeWidth = 4.5, // stroke width for links
  strokeOpacity = 1, // stroke opacity for links
  strokeLinejoin, // stroke line join for links
  strokeLinecap, // stroke line cap for links
  curve = d3.curveBumpX, // curve for the link
} = {}) {

    let wImage = 60*2;
    let hImage = wImage * 29.7/21;

  // If id and parentId options are specified, or the path option, use d3.stratify
  // to convert tabular data to a hierarchy; otherwise we assume that the data is
  // specified as an object {children} with nested objects (a.k.a. the “flare.json”
  // format), and use d3.hierarchy.
  const root = path != null ? d3.stratify().path(path)(data)
      : id != null || parentId != null ? d3.stratify().id(id).parentId(parentId)(data)
      : d3.hierarchy(data, children);

  // Sort the nodes.
  if (sort != null) root.sort(sort);

  // Compute labels and titles.
  const descendants = root.descendants();
  const L = label == null ? null : descendants.map(d => label(d.data, d));
  // Compute the layout.
  const dx = hImage+10;
  const dy = width / (root.height + padding);
  tree().nodeSize([dx, dy])(root);

  // Center the tree.
  let x0 = Infinity;
  let x1 = -x0;
  root.each(d => {
    if (d.x > x1) x1 = d.x;
    if (d.x < x0) x0 = d.x;
  });

  // Compute the default height.
  if (height === undefined) height = x1 - x0 + dx * 2;

  // Use the required curve
  if (typeof curve !== "function") throw new Error(`Unsupported curve`);

  const svg = d3.create("svg")
      .attr("viewBox", [-dy * padding / 2, x0 - dx, width, height])
      .attr("width", width)
      .attr("height", height)
      .attr("style", "max-height: 100%")


    const gAll = svg.append("g"); 

  let gPaths = gAll.append("g")
      .attr("fill", "none")
      .attr("stroke", stroke)
      .attr("stroke-opacity", strokeOpacity)
      .attr("stroke-linecap", strokeLinecap)
      .attr("stroke-linejoin", strokeLinejoin)
      .attr("stroke-width", strokeWidth)
    .selectAll("path")
      .data(root.links())
      .join("path")
        .attr("d", d3.link(curve)
            .x(d => d.y)
            .y(d => d.x));

  let gImages = gAll.append("g")
    .selectAll("image")
    .data(root.descendants())
      .join("image")
        .attr("transform", d => `translate(${d.y},${d.x})`)
        .attr("href", d => d.data.url)
        .attr("width", wImage)
        .attr("height", hImage)
        .attr("x", d => 0)
        .attr("y", d => -hImage/2)
        .style("border-radius", "4px")
        //.style("box-shadow", "0px 0px 10px black;")
        .style("filter", "drop-shadow(0px 0px 5px rgba(0,0,0,1.0))")
        .style("cursor", "pointer")
        .on("click", (event, d) => 
        {
            uiViewGalleryImage.show( d.data.url );
        });

    svg.call(d3.zoom()
      .extent([[0, 0], [width, height]])
      .scaleExtent([1, 20])
      .on("zoom", zoomed));

     function zoomed({transform}) 
     {
        gAll.attr('transform', transform);
    }



  return svg.node();
}