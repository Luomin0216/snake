/*
	author: leeenx
	@ 贪吃蛇的 view 类 
*/

// 获取 Graphics 的 content-box
import '../lib/utils/getContentBoxSize'; 

// 不显示 PIXI 信息
import '../lib/utils/noHello'; 

// 链表类
import Chain from '../lib/utils/Chain'; 


// 按比例 t 混合两个颜色
function mix(c1, c2, t) {
	let r = ((c1 >> 16) & 0xff) * (1 - t) + ((c2 >> 16) & 0xff) * t, 
		g = ((c1 >> 8) & 0xff) * (1 - t) + ((c2 >> 8) & 0xff) * t, 
		b = (c1 & 0xff) * (1 - t) + (c2 & 0xff) * t; 
	return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b); 
}

// 单位向量
function unit(x, y) {
	let len = Math.hypot(x, y) || 1; 
	return [x / len, y / len]; 
}

// view 类
export default class view {
	// 构造函数
	constructor(dom) { 
		// 创建一个 app
		let app = new PIXI.Application(
			750, 
			1206, 
			{ 
				transparent: true
			}
		); 

		// canvas 添加到 page
		dom.appendChild(app.view); 

		// 销毁pixijs的ticker
		app.ticker.destroy(); 

		// 创建 view 的蛇
		this.snake = new Chain(); 

		// 回收节点
		this.collection = []; 

		// 保证 updateTicker 指针永远指向 view
		this.updateTicker = this.updateTicker.bind(this); 

		// 挂载到this
		this.app = app; 
		this.stage = app.stage; 

		// 扩展 PIXI.Graphics
		PIXI.Graphics.prototype.setPostion = function(x, y = x) {
			this.x = x + this.pivot.x; 
			this.y = y + this.pivot.y; 
		}
	}

	// 初始化
	init(config = {}) { 
		// pixijs
		let {
			app, 
			app: {stage, renderer}
		} = this; 

		// 蛇的尺寸挂载到 config 
		config.size = {
			width: config.width / config.row, 
			height: config.height / config.column
		};

		// 初化data
		this.data = config.data; 

		// 全局 config 挂载
		this.config = config; 

		// 游戏活动区
		stage.addChild(this.zone = new PIXI.Container()); 

		// 绘制边界
		this.drawBounds(); 

		// 蛇的图层：阴影 -> 身体 -> 头部
		this.zone.addChild(this.snakeShadow = new PIXI.Graphics()); 
		this.zone.addChild(this.snakeBody = new PIXI.Graphics()); 
		this.zone.addChild(this.snakeHead = new PIXI.Graphics()); 

		// 蛇皮配色
		this.skin = this.createSkin(config.color); 

		// 食物
		this.food = this.calloc(); 
		this.food.visible = false; 

		// 食物动画 - blink
		let [from, to] = [
			{
				alpha: 1
			}, 
			{
				alpha: 0
			}
		]; 
		TweenMax.fromTo(this.food, .2, from, to).repeat(-1).yoyo(true); 

		// 通过 model.zone 创建一张快速定位表
		this.createQuickMap(this.data.zone); 

		// 同步 model 的初始数据
		for(let {data} of this.data.snake) { 
			this.snake.push(data); 
		} 

		this.render(); 

	}

	destroy() {
		let {app, app: {stage}} = this; 
		// 销毁所有子节点
		for(let child of stage.children) {
			child.destroy(); 
		}
		stage.removeChildren(); 
		this.collection = []; 
		this.snake.clean(); 
	}
	// 绘制四条边界
	drawBounds() {
		let {app, app: {stage}} = this,  
		{border, width, height} = this.config,  
		thickness = 8; 
		let bounds = (new PIXI.Graphics())
			.beginFill(0xffffff, 1)
				.lineStyle(thickness, border, 1)
					.drawRect(0, 0, width + thickness, height + thickness); 

		bounds.x = bounds.y = (app.view.width - bounds.cwidth) / 2; 

		stage.addChild(bounds); 
		// bounds 的 index
		stage.setChildIndex(bounds, 0); 

		// 活动空间定位
		[this.zone.x, this.zone.y] = [bounds.x + thickness / 2, bounds.y + thickness / 2]; 
	}

	// 快速寻位表
	createQuickMap(map) { 
		let {width, height} = this.config.size; 
		// 快速表
		this.quickMap = []; 
		for(let {col, row} of map) {
			this.quickMap.push([col * width, row * height]); 
		}

	}

	// 快速计算position
	getPosition(index) {
		return this.quickMap[index]; 
	}

	// 创建节点（食物）
	calloc() { 
		let node; 
		if(this.collection.length === 0) {
			node = new PIXI.Graphics(); 
			let {width, height} = this.config.size; 
			this.drawFood(node, width, height, this.config.food); 
			node.pivot.set(width / 2, height / 2); 
			node.setPostion(0); 
		} else {
			node = this.collection.pop(); 
		}
		
		// 默认显示在容器里
		this.zone.addChild(node); 
		return node; 
	}

	// 绘制一个有光泽的果子
	drawFood(g, width, height, color) {
		let [cx, cy, r] = [width / 2, height / 2 + height * .04, Math.min(width, height) * .36]; 
		g.clear()
			.beginFill(0x000000, .15).drawEllipse(cx + r * .15, cy + r * .9, r * .85, r * .3).endFill()
			.beginFill(mix(color, 0x000000, .35)).drawCircle(cx, cy, r).endFill()
			.beginFill(color).drawCircle(cx - r * .06, cy - r * .06, r * .88).endFill()
			.beginFill(mix(color, 0xffffff, .2)).drawCircle(cx - r * .2, cy - r * .2, r * .55).endFill()
			.beginFill(0xffffff, .75).drawEllipse(cx - r * .38, cy - r * .42, r * .2, r * .13).endFill()
			.lineStyle(Math.max(2, r * .14), 0x6b4423).moveTo(cx, cy - r * .8).lineTo(cx + r * .12, cy - r * 1.2)
			.lineStyle(0)
			.beginFill(0x4caf50).drawEllipse(cx + r * .45, cy - r * 1.05, r * .35, r * .16).endFill(); 
	}

	// 回收节点
	collect(node) {
		node && this.collection.push(node) & this.zone.removeChild(node); 
	}

	// 随机生成食物
	feed(index) { 
		this.food.visible = 1; 
		this.food.setPostion(...this.getPosition(index)); 
	}

	// ticker update
	updateTicker() { 
		if(this.snake.length === 0 || !this.snakeHead) return; 
		this.drawHead(); 
		this.app.renderer.render(this.app.stage); 
	}

	// 状态更新
	update(data) { 
		// 食物更新
		this.food !== data.food && this.feed(data.food); 
		this.updateDelta(data.snake); 
	}

	// 增量更新
	updateDelta(snakeA, snakeB = this.snake) { 
		// snakeA === model.snake, snakeB === view.snake
		this.updateTail(snakeA, snakeB)
			.then(() => this.updateHead(snakeA, snakeB))
			.catch(() => this.wholeUpdate(snakeA, snakeB))
			.then(() => this.render())
	}

	// 检查蛇头
	updateHead(snakeA, snakeB) { 
		return new Promise(
			(resolve, reject) => { 
				// snakeA 与 snakeB 做头指针比较
				let headA, headB = snakeB.first(); 
				// 指针指向头部
				snakeA.setPointer(snakeA.HEAD); 
				while(snakeB.length <= snakeA.length) { 
					headA = snakeA.next(); 
					// 头节点匹配
					if(headA.data === headB.data) {
						// 执行 then 通道
						return resolve(); 
					}
					// 不匹配
					else { 
						// 向snakeB插入头节点
						if(snakeA.HEAD === headA.index) {
							snakeB.unshift(headA.data); 
						}
						// 向snakeB插入第二个节点
						else {
							snakeB.insertAfter(0, headA.data); 
						} 
					}
				}
				// 头指针未匹配上，走 catch 通道
				reject(); 
			}
		); 
	}

	// 检查蛇尾
	updateTail(snakeA, snakeB) {
		return new Promise(
			(resolve, reject) => {
				// snakeA 与 snakeB 做尾指针比较
				let tailA = snakeA.last(), tailB; 
				while(snakeB.length !== 0) { 
					tailB = snakeB.last(); 
					// 尾节点匹配
					if(tailA.data === tailB.data) { 
						// 执行 then 通道
						return resolve(); 
					}
					// 不匹配
					else {
						snakeB.pop(); 
					}
				}
				// 尾指针未匹配上，走 catch 通道
				reject(); 
			}
		); 
	}

	// 全量更新
	wholeUpdate(snakeA, snakeB) { 
		console.log(">>>>>>>>>>>>>>>>>", "low performance"); 
		// 把视图上的蛇回收
		while(snakeB.length !== 0) {
			snakeB.pop(); 
		} 
		// 重头开始插入 snake
		for(let {data} of snakeA) { 
			snakeB.unshift(data); 
		} 
	}

	// 渲染 
	render() {
		this.drawSnake(); 
		this.app.renderer.render(this.app.stage);
	}

	// 根据主色生成蛇皮配色
	createSkin(color = 0x4a8f2a) {
		return {
			shadow: 0xd6d9cf, 
			outline: mix(color, 0x000000, .55), 
			base: color, 
			belly: mix(color, 0xffffcc, .35), 
			pattern: mix(color, 0x000000, .4), 
			patternEdge: mix(color, 0xfff3a0, .45), 
			scale: mix(color, 0x000000, .22), 
			gloss: mix(color, 0xffffff, .6), 
			iris: 0xf4c430, 
			tongue: 0xd7263d
		}; 
	}

	// 蛇节点的中心坐标（从头到尾）
	getPoints() {
		let {width, height} = this.config.size, points = []; 
		for(let {data} of this.snake) {
			let [x, y] = this.getPosition(data); 
			points.push({x: x + width / 2, y: y + height / 2}); 
		}
		return points; 
	}

	// 第 i 个节点的半径：身体饱满，尾部逐渐变尖
	getRadius(i, len) {
		let size = Math.min(this.config.size.width, this.config.size.height), 
			r = size * .42; 
		if(len <= 1) return r; 
		let t = i / (len - 1); 
		if(t > .5) r *= 1 - (t - .5) / .5 * .72; 
		return r; 
	}

	// 用圆 + 梯形拼出一条平滑、可变粗细的管状身体
	drawTube(g, points, radii, color, scale = 1, add = 0, dx = 0, dy = 0) {
		g.beginFill(color); 
		for(let i = 0; i < points.length; ++i) {
			let {x, y} = points[i], r = radii[i] * scale + add; 
			r > 0 && g.drawCircle(x + dx, y + dy, r); 
			if(i === points.length - 1) break; 
			let next = points[i + 1], 
				rn = Math.max(0, radii[i + 1] * scale + add), 
				[ux, uy] = unit(next.x - x, next.y - y), 
				[nx, ny] = [-uy, ux]; 
			g.drawPolygon([
				x + nx * r + dx, y + ny * r + dy, 
				next.x + nx * rn + dx, next.y + ny * rn + dy, 
				next.x - nx * rn + dx, next.y - ny * rn + dy, 
				x - nx * r + dx, y - ny * r + dy
			]); 
		}
		g.endFill(); 
	}

	// 绘制蛇身
	drawSnake() {
		let {snakeShadow: shadow, snakeBody: body, skin} = this; 
		if(!body) return; 
		shadow.clear(); 
		body.clear(); 
		let points = this.getPoints(), len = points.length; 
		if(len === 0) {
			this.snakeHead.clear(); 
			return; 
		}
		let radii = points.map((p, i) => this.getRadius(i, len)); 
		let size = Math.min(this.config.size.width, this.config.size.height); 

		// 投影
		this.drawTube(shadow, points, radii, skin.shadow, 1, 1, size * .1, size * .16); 
		// 描边 + 主体 + 背脊亮带
		this.drawTube(body, points, radii, skin.outline); 
		this.drawTube(body, points, radii, skin.base, 1, -size * .06); 
		this.drawTube(body, points, radii, skin.belly, .42, 0, -size * .03, -size * .03); 

		// 侧面鳞片：沿身体两侧交错排列
		body.beginFill(skin.scale); 
		for(let i = 0; i < len - 1; ++i) {
			let [a, b] = [points[i], points[i + 1]], 
				[ux, uy] = unit(b.x - a.x, b.y - a.y), 
				[nx, ny] = [-uy, ux]; 
			for(let k = 0; k < 4; ++k) {
				let t = (k + .5) / 4, 
					r = radii[i] + (radii[i + 1] - radii[i]) * t, 
					[x, y] = [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t], 
					side = k % 2 ? 1 : -1; 
				body.drawCircle(x + nx * r * .66 * side, y + ny * r * .66 * side, r * .13); 
				body.drawCircle(x - nx * r * .66 * side, y - ny * r * .66 * side, r * .09); 
			}
		}
		body.endFill(); 

		// 背部菱形花纹（带浅色描边）
		for(let i = 1; i < len; ++i) {
			let {x, y} = points[i], r = radii[i], 
				prev = points[i - 1], next = points[i + 1] || points[i], 
				[ux, uy] = unit(next.x - prev.x, next.y - prev.y), 
				[nx, ny] = [-uy, ux]; 
			let diamond = (along, across) => [
				x + ux * along, y + uy * along, 
				x + nx * across, y + ny * across, 
				x - ux * along, y - uy * along, 
				x - nx * across, y - ny * across
			]; 
			body.beginFill(skin.patternEdge).drawPolygon(diamond(r * .78, r * .62)).endFill(); 
			body.beginFill(skin.pattern).drawPolygon(diamond(r * .6, r * .46)).endFill(); 
		}

		// 鳞片高光
		body.beginFill(skin.gloss); 
		for(let i = 1; i < len; ++i) {
			let {x, y} = points[i], r = radii[i]; 
			body.drawEllipse(x - r * .38, y - r * .42, r * .2, r * .12); 
		}
		body.endFill(); 

		this.drawHead(); 
	}

	// 绘制蛇头（含吐信动画），本地坐标系 x 轴朝向蛇的前进方向
	drawHead() {
		let {snakeHead: g, skin} = this, 
			points = this.getPoints(); 
		if(points.length === 0) return; 
		let s = Math.min(this.config.size.width, this.config.size.height), 
			[head, neck] = points, 
			angle = neck ? Math.atan2(head.y - neck.y, head.x - neck.x) : 0; 
		g.clear(); 
		g.position.set(head.x, head.y); 
		g.rotation = angle; 

		// 吐信：周期性伸缩
		let phase = (Date.now() % 1800) / 1800; 
		if(phase < .3) {
			let len = Math.sin(phase / .3 * Math.PI) * s * .5, 
				tip = s * .55 + len; 
			g.lineStyle(Math.max(1.5, s * .06), skin.tongue)
				.moveTo(s * .45, 0).lineTo(tip, 0)
				.lineTo(tip + len * .35, -len * .22)
				.moveTo(tip, 0)
				.lineTo(tip + len * .35, len * .22)
				.lineStyle(0); 
		}

		// 头部轮廓（略呈三角的椭圆）
		g.beginFill(skin.outline)
			.drawEllipse(s * .12, 0, s * .52, s * .46)
			.drawEllipse(s * .38, 0, s * .3, s * .32)
			.endFill(); 
		g.beginFill(skin.base)
			.drawEllipse(s * .12, 0, s * .46, s * .4)
			.drawEllipse(s * .38, 0, s * .25, s * .27)
			.endFill(); 
		// 头顶亮区 + V 形花纹
		g.beginFill(skin.belly).drawEllipse(s * .14, 0, s * .3, s * .18).endFill(); 
		g.beginFill(skin.pattern)
			.drawPolygon([
				-s * .2, -s * .2, 
				s * .22, 0, 
				-s * .2, s * .2, 
				-s * .06, 0
			])
			.endFill(); 

		// 眼睛：黄色虹膜 + 竖瞳 + 高光
		for(let side of [-1, 1]) {
			let [ex, ey] = [s * .26, side * s * .25]; 
			g.beginFill(skin.outline).drawCircle(ex, ey, s * .12).endFill(); 
			g.beginFill(skin.iris).drawCircle(ex, ey, s * .095).endFill(); 
			g.beginFill(0x111111).drawEllipse(ex, ey, s * .065, s * .022).endFill(); 
			g.beginFill(0xffffff).drawCircle(ex + s * .03, ey - s * .035, s * .025).endFill(); 
		}

		// 鼻孔
		g.beginFill(skin.outline)
			.drawCircle(s * .56, -s * .08, s * .025)
			.drawCircle(s * .56, s * .08, s * .025)
			.endFill(); 
	}
}

