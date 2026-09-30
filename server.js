const {loadEnv,settings}=require('./config');
const {createApp}=require('./app');
loadEnv();
const config=settings();
const app=createApp(config);
app.listen().then(()=>console.log(`Afterhours listening on http://localhost:${config.port}`)).catch(error=>{console.error(error);process.exitCode=1;app.close().catch(console.error);});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit()).catch(error=>{console.error(error);process.exitCode=1;}));
