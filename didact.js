// 创建虚拟dom
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  }
}

// 创建txtdom
function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

// 创建dom
function createDom(fiber) {
  const dom =
    fiber.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  // 更新dom
  updateDom(dom, {}, fiber.props)

  return dom
}

// 判断是否是事件
const isEvent = (key) => key.startsWith("on")

// 如果不是子节点 也不是 事件
const isProperty = (key) =>
  key !== "children" && !isEvent(key)
// 判断是否是新的属性
const isNew = (prev, next) => (key) =>
  prev[key] !== next[key]

// 判断属性是否存在对象中
const isGone = (prev, next) => (key) =>
  !(key in next)

// 更新dom
function updateDom(
  dom,
  prevProps, // 上一次属性
  nextProps // 下一次属性
) {
  //Remove old or changed event listeners
  Object.keys(prevProps)
    // 如果是事件
    .filter(isEvent)
    //如果 下一个属性不存在则去执行一下这个方法
    .filter(
      (key) =>
        !(key in nextProps) ||
        isNew(prevProps, nextProps)(key)
    )
    // 然后删除掉事件
    .forEach((name) => {
      const eventType = name
        .toLowerCase()
        .substring(2)
      dom.removeEventListener(
        eventType,
        prevProps[name]
      )
    })

  // 删除旧的属性
  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    // 判断属性是否存在对象中 如果不存在则删除
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = ""
    })

  // Set new or changed properties
  // 下一个属性
  Object.keys(nextProps)
    // 如果不是子节点 也不是 事件
    .filter(isProperty)
    //  判断是否是新的属性
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      //添加下一个属性
      dom[name] = nextProps[name]
    })

  // 添加事件
  // Add event listeners
  Object.keys(nextProps)
    // 如果是事件
    .filter(isEvent)
    // 如果是新的事件
    .filter(isNew(prevProps, nextProps))

    .forEach((name) => {
      // 添加事件
      const eventType = name
        .toLowerCase()
        .substring(2)

      dom.addEventListener(
        eventType,
        nextProps[name]
      )
    })
}

// 首次提交 commitRoot
function commitRoot() {
  //
  deletions.forEach(commitWork)
  // 提交任务更新真实ｄｏｍ
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}

// 提交任务
function commitWork(
  fiber // 调度
) {
  if (!fiber) {
    return
  }

  // 找到最顶层的parent
  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  if (
    fiber.effectTag === "PLACEMENT" &&
    fiber.dom != null
  ) {
    // 真实dom
    domParent.appendChild(fiber.dom)
  } else if (
    fiber.effectTag === "UPDATE" &&
    fiber.dom != null
  ) {
    // 更新真实的dom
    updateDom(
      fiber.dom,  // 当前dom
      fiber.alternate.props,  // 交替 上一次属性
      fiber.props    // 下一次属性
    )
  } else if (fiber.effectTag === "DELETION") {
    // 删除
    commitDeletion(fiber, domParent)
  }

  // 链式调用
  commitWork(fiber.child)
  // 链式调用
  commitWork(fiber.sibling)
}

// 删除真实dom
function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    // 删除dom
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}

// dom.render 渲染
function render(
  element, // 字节点
  container // 根节点
) {
  // 初始化 赋值给 wipRoot
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    //
    alternate: currentRoot,
  }
  deletions = []
  nextUnitOfWork = wipRoot
}

// 下一个工作
let nextUnitOfWork = null
// 当前调度
let currentRoot = null

// 在制造中root  fiber
let wipRoot = null

let deletions = null

// 一直在轮询 判断浏览器是否有空闲
function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {    // 如果有空闲
    // 如果有空闲 // 更新  执行工作单元
    // 更新fiber线程
    nextUnitOfWork = performUnitOfWork(
      nextUnitOfWork
    )
    // 判断浏览器是否有空闲 不断的while循环轮训查看浏览器是否有空闲
    shouldYield = deadline.timeRemaining() < 1
  }

  // 第一次工作
  if (!nextUnitOfWork && wipRoot) {
    // 首次提交 commitRoot
    // 执行　fiber　线程变成真实　ｄｏｍ
    commitRoot()
  }

  // 回调递归
  requestIdleCallback(workLoop)
}

// 初始化调度轮询
requestIdleCallback((...ags) => {
  workLoop(...ags)
})



// 更新  执行工作单元
function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function
   // 如果是函数 组加你
  if (isFunctionComponent) {
    // 更新调度线程
    updateFunctionComponent(fiber)
  } else {
    // 如果是Host 组件
    updateHostComponent(fiber)
  }
  // 如果有子节点 则返回 子节点
  if (fiber.child) {
    return fiber.child
  }

  let nextFiber = fiber
  while (nextFiber) {
    // 如果找到兄弟节点则返回兄弟节点
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    // 如果找不到则链表指向上一个父节点
    nextFiber = nextFiber.parent
  }
}

let wipFiber = null
let hookIndex = null


//　更新调度线程
function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  const children = [fiber.type(fiber.props)]
  //整理调度线程
  reconcileChildren(fiber, children)
}

function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }

  const actions = oldHook ? oldHook.queue : []
  actions.forEach((action) => {
    hook.state = action(hook.state)
  })

  const setState = (action) => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }

  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state, setState]
}

// 更新　ｈｏｓｔ组件　更新调度线程
function updateHostComponent(fiber) {
  // 创建dom
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  // 整理调度线程
  reconcileChildren(fiber, fiber.props.children)
}


// 整理调度线程
function reconcileChildren(
   wipFiber,   // 当前调度
   elements // 子节点
   ) {
  let index = 0
  let oldFiber =
    wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (
    index < elements.length ||
    oldFiber != null
  ) {
    const element = elements[index]
    let newFiber = null

    // 节点判断类型是否相同
    const sameType =
      oldFiber &&
      element &&
      element.type == oldFiber.type

    if (sameType) {
      // 如果类型相同则是更新
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }

     // 如果类型不相同
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }

    // 如果类型不相同则删掉
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

   // 指向下一个兄弟节点
    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if (index === 0) {
      // 如果 index 等于 0  ， newFiber挂载在  wipFiber.child 
      wipFiber.child = newFiber
    } else if (element) {
      // 下一次一直挂载在sibling　中
      prevSibling.sibling = newFiber
    }
     //
    prevSibling = newFiber
    index++
  }
}

const Didact = {
  createElement,
  render,
  useState,
}

window.Didact = Didact
