import { useMemo } from 'react'
import { PhonePreview } from '../../../components'
import { normalizeArticleDom } from '../../../pipeline/normalize'
import { highlightArticleHtml } from '../../../theme/highlight'

const SAMPLE_TITLE = '示例'

const SAMPLE_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="280" viewBox="0 0 640 280">
    <defs>
      <radialGradient id="sky-glow">
        <stop stop-color="#e9ad87" stop-opacity=".32"/>
        <stop offset=".56" stop-color="#edbd99" stop-opacity=".2"/>
        <stop offset="1" stop-color="#edbd99" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="cloud-glow">
        <stop stop-color="#e5a47f" stop-opacity="0"/>
        <stop offset=".54" stop-color="#e5a47f" stop-opacity=".18"/>
        <stop offset="1" stop-color="#e5a47f" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="water-glow" cx="72%" cy="12%" r="30%">
        <stop stop-color="#eaddc7"/>
        <stop offset="1" stop-color="#e9e3d3"/>
      </radialGradient>
    </defs>
    <rect width="640" height="280" fill="#f0e9d9"/>
    <ellipse cx="462" cy="126" rx="210" ry="99" fill="url(#sky-glow)"/>
    <g fill="url(#cloud-glow)">
      <path d="M327 124C348 124 365 115 388 117S419 121 447 115C425 125 407 123 386 122S350 129 327 124Z"/>
      <path d="M497 137C514 137 523 132 540 133S562 135 577 131C562 139 551 138 538 137S511 141 497 137Z"/>
    </g>
    <circle cx="474" cy="106" r="38" fill="#d9a380"/>
    <path d="M0 135 63 101 121 143 149 136 192 192V210H0Z M640 136 571 117 521 150 495 145 449 192V210H640Z" fill="#a7ada0"/>
    <path d="M0 162 48 137 107 165 137 155 174 192V210H0Z M640 163 596 143 553 166 516 159 471 192V210H640Z" fill="#7d8b7e"/>
    <path d="M0 194Q100 184 192 192H449Q546 184 640 194V280H0Z" fill="url(#water-glow)"/>
    <g fill="none" stroke-linecap="round">
      <path d="M318 211h99m-214 17h150m95 14h112M79 254h126" stroke="#b2ae9b" stroke-width="2"/>
      <path d="M373 91q11-8 23 3 8-12 20-10" stroke="#3f4841" stroke-width="3"/>
    </g>
  </svg>`
)}`

/** 王勃《滕王阁序》节选，分节标题和读序札记为示例编排 */
const SAMPLE_ARTICLE = `
<h1>滕王阁序</h1>
<p>唐 · 王勃（节选）</p>
<h2>洪都胜地</h2>
<p>豫章故郡，洪都新府。星分翼轸，地接衡庐。襟三江而带五湖，控蛮荆而引瓯越。物华天宝，龙光射牛斗之墟；人杰地灵，徐孺下陈蕃之榻。</p>
<h2>秋日登阁</h2>
<p>时维九月，序属三秋。潦水尽而寒潭清，烟光凝而暮山紫。俨骖騑于上路，访风景于崇阿。临帝子之长洲，得天人之旧馆。层峦耸翠，上出重霄；飞阁流丹，下临无地。鹤汀凫渚，穷岛屿之萦回；桂殿兰宫，即冈峦之体势。</p>
<h3>俯瞰江天</h3>
<p>披绣闼，俯雕甍。山原旷其盈视，川泽纡其骇瞩。闾阎扑地，钟鸣鼎食之家；舸舰弥津，青雀黄龙之舳。云销雨霁，彩彻区明。</p>
<blockquote><p>落霞与孤鹜<sup>1</sup>齐飞，秋水共长天一色。</p></blockquote>
<p>渔舟唱晚，响穷彭蠡之滨；雁阵惊寒，声断衡阳之浦。</p>
<figure>
  <img src="${SAMPLE_IMAGE}" alt="暮山、落霞与飞鸟相映，秋江向远处延伸" />
  <figcaption>图 1 · 秋水长天</figcaption>
</figure>
<hr />
<h2>读序札记</h2>
<h3>字词简注</h3>
<table>
  <thead><tr><th>字词</th><th>读音</th><th>句中含义</th></tr></thead>
  <tbody>
    <tr><td>潦水</td><td>lǎo shuǐ</td><td>雨后积水</td></tr>
    <tr><td>绣闼</td><td>xiù tà</td><td>装饰华美的门</td></tr>
    <tr><td>雕甍</td><td>diāo méng</td><td>雕饰华美的屋脊</td></tr>
  </tbody>
</table>
<h4>景物的次序</h4>
<ul>
  <li>先写潭水、暮山和楼阁，交代登临所见。</li>
  <li>再写落霞、孤鹜和秋水，视线从楼阁推向江天。</li>
  <li>末尾由渔歌和雁声收束，把远景落到听觉上。</li>
</ul>
<h5>摘句对读</h5>
<p>将上下句分别记作 A<sub>1</sub> 和 A<sub>2</sub>，录入 <code>couplet</code>，便于并排对读。</p>
<pre><code class="language-typescript">const couplet = {
  a1: '落霞与孤鹜齐飞',
  a2: '秋水共长天一色',
}</code></pre>
<h6>注 1 · 孤鹜</h6>
<p>鹜读 wù。孤鹜指独飞的野鸭。</p>
`

type SamplePreviewProps = {
  styleCss: string
  variables: Record<string, string>
}

/** 主题配置页左侧：固定示例文章，使用当前草稿实时渲染 */
export const SamplePreview = ({ styleCss, variables }: SamplePreviewProps) => {
  const sampleHtml = useMemo(() => {
    const doc = new DOMParser().parseFromString(SAMPLE_ARTICLE, 'text/html')
    normalizeArticleDom(doc, SAMPLE_TITLE)
    return highlightArticleHtml(doc.body.innerHTML)
  }, [])

  return (
    <PhonePreview
      title={SAMPLE_TITLE}
      ariaLabel="主题预览"
      styleCss={styleCss}
      variables={variables}
      html={sampleHtml}
      className="border-r border-divider"
    />
  )
}

SamplePreview.displayName = 'SamplePreview'
