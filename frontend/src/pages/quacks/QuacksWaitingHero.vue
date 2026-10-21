<script setup lang="ts">
import vector from '../../assets/quacks/vector.svg';
import pot from '../../assets/quacks/pot.svg';
import chips from '../../assets/quacks/chips.svg';
import steam from '../../assets/quacks/steam.svg';
</script>
<template>
  <section class="vue-quacks-rq03-hero" aria-labelledby="quacksWaitingTitle">
    <div class="vue-quacks-rq03-art" aria-hidden="true">
      <div class="vue-quacks-rq03-art-layers">
        <img class="rq03-vector" :src="vector" alt="" />
        <img class="rq03-pot" :src="pot" alt="" />
        <img class="rq03-chips" :src="chips" alt="" />
        <span class="rq03-number rq03-one">1</span><span class="rq03-number rq03-two">2</span
        ><span class="rq03-number rq03-four">4</span>
        <img class="rq03-steam" :src="steam" alt="" />
      </div>
    </div>
    <div class="vue-quacks-rq03-copy">
      <small>CLASSIC MODE · 2–8 人一起煮藥</small>
      <h1 id="quacksWaitingTitle">藥袋已備，等房主開釜。</h1>
      <p>九回合同步抽藥，逐色共選本局藥材效果。<br />可加入草藥女巫與煉金術士。</p>
    </div>
  </section>
</template>
