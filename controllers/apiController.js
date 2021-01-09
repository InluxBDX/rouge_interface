
require('dotenv').config()
const fs = require('fs');
const csv = require('csv-parser');
var Usuario = require('../models/usuarios');
var Session = require('../models/session');
var Projeto = require('../models/projetos');
var Resultado = require('../models/resultado');
const path = require('path');
var async = require('async')

const port = process.env.PORT || '3000';


const md5 = require('md5');
const { body,validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
var propertiesReader = require('properties-reader');
const { resolve } = require('path');
const { json } = require('express');
const { RSA_NO_PADDING } = require('constants');
var properties = propertiesReader('rouge/rouge.properties');


let results = [];


exports.api_login_post = (req,res,next) =>{

  try{
    Usuario.findOne({'email': req.body.email})
    .exec(function(err, results){
        console.log(results);
        if(err) return next(err);      
        if (results && (results.email == req.body.email)) {
             Session.findOne({'usuario' : results}) 
             .exec(function(err,session) {  
                if(err) {
                    console.log(err);
                    res.render('login', {"success": false, "user": null, "message": "Ocorreu um problema na conexão com o banco de dados"});
                 }
                 if((session==null || session==undefined) &&
                         (md5(req.body.senha) ==results.senha)){
                            fetch("http://localhost:"+port+"/api/session/", {
                                method: 'POST',
                                headers: {
                                'Content-Type': 'application/json',       
                                },
                                mode : 'cors',        
                                body : JSON.stringify({usuario:  results}),
                            })
                            .then (response => response.json())
                            .then(data => {
                               res
                               .status(201)
                               .cookie('session', data.session._id, {
                               /* expires: new Date(Date.now() + 8 * 3600000) ,*/ httpOnly: true
                               })                      
                               .redirect('home');     
                            
                            }).catch (err => {   
                                console.log(err);
                                res.render('login', {"success": false, "user": null, "message": "Ocorreu um problema no login. Por favor tente novamente"});
                            });
                }else if ((session && session.refreshToken) 
                            && (md5(req.body.senha) == results.senha)) {                                                                            
                            fetch("http://localhost:"+port+"/api/token", {    
                                    method: 'POST',
                                    headers: {
                                        'Accept': 'application/json',
                                        'Access-Control-Allow-Origin' : '*',
                                    'Content-Type': 'application/json',          
                                    },
                                    mode : 'cors',
                                
                                    body : JSON.stringify({"refreshToken" : session.refreshToken}),
                                })
                                .then(response => response.json())
                                .then (token => {                                        
                                    let tokenTemp = session.refreshToken;
                                    delete session.refreshToken;
                                    res
                                    .status(201)
                                    .cookie('session',session._id, {
                                    /*expires: new Date(Date.now() + 8 * 3600000),*/ httpOnly: true 
                                    })                                   
                                    .redirect('home');     
                            
                                }).catch (err => {                                    
                                    console.log(err);                                    
                                    res.render('login', {"success": false, "user": null, "message": "Ocorreu um problema no login. Por favor tente novamente"});
                                    
                                 });              
                } else {
                    res.render('login', {"success": false, "user": null, "message": "Usuario ou senha incorretos"});
                }                      
        })

     } else{
        res.render('login', {"success": false, "user": null, "message": "Usuário não existe no banco de dados"});
        }
    });
  } catch(e){
        res.render('login', {"success": false, "user": null, "message": "Ocorreu o um problema na requisição. Por favor recarregue a página"});
  }
    
}

exports.api_login_get = (req,res,next) =>{
    res.render('login');    
}

exports.api_user_registrar_get = (req,res,next) =>{

    res.render('registrar', {"success": true, "method": 'get', "api" : "/registrar"});
}

exports.api_logout = (req,res,next) => {
    //Refatorar para tratar mais cenários de erros
    if(req && req.cookies.session){
        const session_id = req.cookies.session;
      
        Session.findOneAndDelete({'_id' : session_id}) 
          .exec(function(err,session) {
            if(err){
                console.log(err)
                res.redirect('login');
            } 
              if(session){               
                  //console.log(session);
                  res.redirect('login');
              }

})

    }
}

exports.api_perfil = (req,res,next) => {
      
        if(req && req.cookies.session){   
             Usuario.findOne({'_id' : req.idUser})
             .exec( (err, result) =>{

        if(result){
                    res.render('perfil', {success: true, usuario: result});
                }else{
                    res.render('perfil', {success: false, message: "Usuário não encontrado"});
        }
        })
    }else{
        res.render('perfil', {success: false, message: "Requição inválida"});
    }

      

}

exports.api_user_registrar_post =  [
                
                body('nome', 'O nome deve ter no mínimo 5 caracteres.').trim().isLength({ min: 5 }).escape(),
                body('nome', 'Nome não pode ser vazio').trim().isLength(0).escape(),
                body('email', 'Email inválido.').trim().isEmail().normalizeEmail(),
                body('senha', 'Senha inválida. Mínimo 5 caracteres.').trim().isLength({ min: 5 }).escape(),
                body('senha_2', 'Senha inválida. Mínimo 5 caracteres').trim().isLength({ min: 5 }).escape(),
                body('senha', "As senhas não são iguais").custom((value, {req}) => value === req.body.senha_2),

                (req,res,next) =>{
                   if(req && req.body && req.headers){
                     const user = {name: req.body.email}; 
                        const errors = validationResult(req);
                        var usuario = new Usuario({
                            
                            nome : req.body.nome,
                            email : req.body.email,
                            senha : md5(req.body.senha),
                        });
                    if(!errors.isEmpty()){                   
                        res.render('registrar', {success: false, body: true, message : errors.array()}); 
                    }else{
                        Usuario.findOne({'email' : req.body.email})
                        .exec( (err, result) =>{
                            console.log(result);
                            if(err) return console.log(err);
                            if(result===null || result===undefined){
                                usuario.save((err) =>{                                
                                    if(err) return res.render('registrar', {success : false, message : "MongoDB: " + err, "origem": "back"});
                                
                                    fetch("http://localhost:"+port+"/api/session/", {
                                        method: 'POST',
                                        headers: {
                                        'Content-Type': 'application/json',       
                                        },
                                        mode : 'cors',        
                                        body : JSON.stringify({usuario:  usuario}),
                                    })
                                    .then (response => response.json())
                                    .then(data => {    
                                        console.log(data);                                   
                                        res
                                    .cookie('session',data.session._id, {
                                        /*expires: new Date(Date.now() + 8 * 3600000),*/ httpOnly: true 
                                        })
                                        .redirect('home'); 
                                        
                                    
                                        
                                }).catch(err => {res.render('registrar', {success: false, message :"Não foi possível criar a sessão", errors: err})});                    
                                })
                            }else{
                                res.render('registrar', {success: false, mongo: true, "message" : "O email informado já possui um registro.", errors: err});
                            }
                        });                   
                    }

                }else{
                    res.render('registrar', {success: false, "message" : "Ocorreu um erro na requição"});
                }
}
];

exports.api_gera_token = (req, res) => {
    const refreshToken = req.body.refreshToken;    
    if (refreshToken == null) return res.sendStatus(401) 
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {     
      if (err) return res.sendStatus(403)
      const accessToken = geraAccessToken({ name: user.name });   
      res.setHeader('Access-Control-Allow-Origin', '*');   
      res.json({accessToken: accessToken})
    })
  }


exports.api_session_criar = function ( req, res, next ) {
   
    if (req && req.body.usuario.email){
        const user = {name: req.body.usuario.email};  
        
        const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET);
        console.log("Refresh token: " + refreshToken);                      
        console.log("API: Session: Criar - /api/session/");
        
        var session = new Session({
            usuario  : req.body.usuario,
            refreshToken : refreshToken,
            loggedIn : true,
            sessionExpires : Date.now() + 2,
        })                
    Session.findOne({ 'usuario': req.body.usuario._id})
    .populate('usuario')
    .exec( function(err, found_user) {
       if (err) { return next(err); }
        if(found_user){        
            res.json({session: found_user, "success": false, "message": "Sessão já existe"});      
        }else{               
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
        session.save(function(err){
                if(err) return next(err); 
                //const id_usuario = session.usuario;
                //console.log(id_usuario);//
                //localStorage.setItem(session.usuario, refreshToken);
                      
                res.json({session})
               // res.json({refreshToken: refreshToken, "success": true, "message": "user registered"});
                   
                    
            })

        }
    });
}else{
    res.json({"success" : false, "headers" : "not presented"});
}

};


function geraAccessToken(user) {
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '86400s' })
  }
  


const rouge_properties = {
            rougeType: properties.get("rouge.type"),
            ngram : properties.get("ngram"),
            stopwordsUse : properties.get("stopwords.use"),
            stopwordsFile : properties.get("stopwords.file"),
            stemmerUse : properties.get("stemmer.use"),
            stemmerName : properties.get("stemmer.name"),
            topicType : properties.get("topic.type"),
            synonymsUse : properties.get("synonyms.use"),
            synonymsDir : properties.get("synonyms.dir"),
            beta : properties.get("beta"),
            postaggerNam : properties.get("pos_tagger_nam")
  }

function formataRougeProperties(projetoPath, projetoOutput){

    return new Promise((resolve, reject) =>{
        try{
            if(properties && projetoOutput && projetoPath){            
                    properties.set('project.dir', path.join(process.cwd() +'/' + projetoPath));
                    properties.set('outputFile', path.join(process.cwd() +'/' + projetoOutput + '/' + 'result.csv'));
                    //console.log("Projeto directório:" + properties.get('project.dir'));
            
                    let rougeProperties = JSON.stringify(properties._properties);
                    rougeProperties = rougeProperties.replace(/":"/g, "=")
                    .replace(/","/g, "\n")
                    .replace(/"}/g, "")
                    .replace(/{"/g, ""); 
                
                    try{
                        if(rougeProperties){
                            fs.writeFileSync(projetoPath + '/rouge.properties', rougeProperties);                      
                            resolve({success: true, message: "rouge.properties criado"})            
                        }
                    }catch(err){
                        reject({success : false, message : "Não foi possível gravar o rouge.properties"});
                    }     
        }
        }catch(err){
                    reject({success: false, message: "Execução não foi possível"});
        }
 }).catch((err) => {    
    reject({success: false, message: "Não foi possível iniciar a formatação do arquivo properties"});

});
}


function criaDiretorios(idProjeto){

   return new Promise(resolve =>{ 
        try{
            if(idProjeto && idProjeto!=null && idProjeto!=undefined){
                    try{
                        fs.mkdirSync('projetos/' + idProjeto + '/results', { recursive: true });
                        fs.mkdirSync('projetos/' + idProjeto + '/reference', { recursive: true });
                        fs.mkdirSync('projetos/' + idProjeto + '/system', { recursive: true });
                        resolve({success: true, message: "Diretórios results, reference e system criados"})
                    }catch(err){
                        resolve({success: false, message: "Não foi possível criar os diretórios"})
                    }                 
                }
         } catch(err){
                        resolve({success: false, message: "Não foi possível criar o diretório /system"})
                }         
        }).catch(err =>{
            resolve({success: false, message: "Nenhum diretório foi criado"});
        });

};


function execRouge(projetoPath){

    return new Promise(resolve =>{
        try{       
            const { exec} = require("child_process");
            let rougeProperties = path.join(process.cwd() +'/' + projetoPath + '/' + 'rouge.properties');
            try{ 
                if(rougeProperties){             
                        exec('java -jar -Drouge.prop=' + rougeProperties.toString() + ' ' + path.join(process.cwd().toString() + '/rouge/rouge2-1.2.2.jar'), (error, stdout, stderr) => {
                        if (error) {
                            resolve({success:false, message : "Não foi possível executar o ROUGE2", error: error})
                            return;
                        }
                        if (stderr) {
                            reject({success:false, message : "Não foi possível executar o ROUGE2", error: stderr})                    
                        }
                        resolve({success:true, message : "ROUGE foi executado corretamente"})                      
                          //console.log(`stdout: ${stdout}`);                          
                         });            
                     };
            } catch(err){
                reject({success:false, message : "Não foi possível executar o ROUGE2"})
            }
        } catch(err){
            reject({success:false, message : "Não foi possível iniciar o processo de execução", error: err})

        }

 });
}


function gravaArquivos(reference,system, projetoPath){

    return new Promise(resolve => {
        try{
            if(reference && system && projetoPath){
                try{
                    for(let i=0;i<reference.length;i++){
                        fs.writeFileSync(projetoPath +'/reference/' +reference[i].name , reference[i].data, (err)=> {      
                                if(err) reject({success: false, message: "Não foi possível gravar o arquivo reference", erro: err});                                           
                        })
                    };  
                } catch(err){
                    reject({success: false, message: "Não foi possível gravar o arquivo reference"});
                }
                
                try{
                    for(let i=0;i<system.length;i++){
                        fs.writeFileSync(projetoPath +'/system/' + system[i].name , system[i].data, (err)=> {      
                                if(err) return console.log(err);                                                
                        })
                    }
                } catch(err){
                    reject({success: false, message: "Não foi possível gravar o arquivo system"});

                }
                    reject({success: true, message: "Arquivos system e reference gravados corretamente"});
            
            
            }
 } catch(err){
            resolve({success: false, message: "Não foi possível gravar os arquivos"});
        }
})

}

const validaReference = (reference) => {
    if(reference){       
        if(!reference.length) {            
            return (reference.mimetype == 'text/plain' &&
            reference.name.split(".")[1] == "txt") ? true : false;

        }else {
            for(i=0;i<reference.length;i++){                
                if(reference[i].mimetype == 'text/plain' &&
                        reference[i].name.split(".")[1] == "txt"){                         
                }else{
                return false;
                 }
            }        
        }
        return true;
    }else{
        return false;
    }
        
}
function validaSystem(system){ 
    if(system){
        if(!system.length){
            return (system.mimetype == 'text/plain' &&
            system.name.split(".")[1] == "txt") ? true : false;
        }else{                 
                for(i=0;i<system.length;i++){
                    if(system[i].mimetype == 'text/plain' &&
                    system[i].name.split(".")[1] == "txt"){                                
                    }else{
                        return false;
                    }
            }
        }
            return true;
    }else{
        return false;
    }    

}

function formataNgram(string){
    return string.replace(/ /g,"").split(",").
    map((a) => {return a.replace(/^[0-9]+|^S[0-9]+|^SU[0-9]+|^[L]/g,"")}).join("")==""
}
/*
function formataNgram(ngram){
    let count = 0;
    if(ngram){
        //Verificar como criar um regex com o padrão N,SN,SUN,L
        //Verificar repetições
        console.log(ngram);
        for(let i=0; i<ngram.length;i++){            
            if((parseInt(ngram[i]))){}
            else if(ngram[i].split('')[0]=='S' && 
            ngram[i].split('')[1]==parseInt(ngram[i].split('')[1])){}
            else if((ngram[i].split('')[0]=='S' && ngram[i].split('')[1]=='U'
            && ngram[i].split('')[2]==parseInt(ngram[i].split('')[2]))){}
            else if(ngram[i]=='L'){}           
            else{
                return false;
            }            
        }
            return true;
    }
}*/


let arquivoProperties = {
    ngram: '',
    beta: '',
    stopwords_use: '',
    synonyms_use: '',
    stemmer_use: '',
    route_type: '',
    post_tagger: '',
    stemmer_name: '' ,
    project_dir : '',
    outputFile : '',
    stopwords_file : "",
    topic_type : "",
}
exports.api_rouge_prepara = (req,res,next) =>{ 
    if(req && req.user.name){
        console.log(req.body);     
        arquivoProperties.ngram = req.body.ngram || properties.get('ngram');
        arquivoProperties.beta = parseFloat(req.body.beta) || parseFloat(properties.get('beta'));
        arquivoProperties.rouge_type = req.body.rouge_type || properties.get('rouge.type');
        arquivoProperties.post_tagger = req.body.post_tagger || properties.get('pos_tagger_name');
        arquivoProperties.stemmer_name = req.body.stemmer_name || properties.get('stemmer.name');
        arquivoProperties.synonyms_use = req.body.synonyms_use || properties.get('synonyms.use');
        arquivoProperties.stemmer_use = req.body.stemmer_use || properties.get('stemmer.use');
        arquivoProperties.stopwords_use = req.body.stopwords_use || properties.get('stopwords.use');
        arquivoProperties.topic_type = req.body.topic_type || properties.get('topic.type');
        
        console.log(arquivoProperties); 
        let reference = req.files.reference;
        let system = req.files.system;         
        let ngramValida = formataNgram(arquivoProperties.ngram)
        let referenceValida = validaReference(reference)
        let systemValida = validaSystem(system);    
         if(!ngramValida){
            res.render('rouge_page',{success : false,message :"Ngram inválido. Por favor insira a métrica correta."});     
         }else if(!referenceValida || !systemValida){        
            res.render('rouge_page',{success : false,message :"Arquivos inválidos. Verifique se formato de arquivo é txt."});
         }else{ 
                Usuario.findOne({'email' : req.user.name})
                .exec((err,usuario)=>{
                        if(err) console.log(err)                      
                        if(usuario!=null && usuario!=undefined && 
                        (req.body.projeto!=undefined && req.body.projeto!=null && req.body.projeto!="")
                        && req.files.reference!=null && req.files.system!=!null ){                                                        
                                var projeto = new Projeto({                            
                                    usuario : usuario,
                                    nome:   req.body.projeto,
                                })
                                projeto.save((err) =>{
                                    if(err) return console.log(err);                                
                                                                                                                              
                                  //  rouge_properties.rougeType = req.body.type_rouge;
                                   // console.log(rouge_properties.rougeType);                                   
                                
                                    let projetoPath = 'projetos/' + projeto._id;
                                    let projetoOutput = 'projetos/' + projeto._id + '/results';
                                    arquivoProperties.outputFile = 'projetos/' + projeto._id + '/results';                                
                                    arquivoProperties.project_dir = 'projetos/' + projeto._id;
                                   
                              
                                //Verificar forma de parar execução caso retorno de sucesso de qualquer promise seja false
                                //verificar porque promise não é retornada com a função de salvar    
                                async function callRougue(){
                                        let diretorio = await criaDiretorios(projeto._id);
                                        console.log({'Diretórios criados' : diretorio.success});                         
                                
                                        let rouge_properties = await formataRougeProperties(projetoPath, projetoOutput);   
                                        console.log({'rouge.properties alterado' : rouge_properties.success});                         
                                    
                                        let arquivos = await gravaArquivos(reference,system,projetoPath);
                                        console.log({'Arquivos refence/system gravados' : arquivos.success});
                                    
                                        let executaRouge = await execRouge(projetoPath);
                                        console.log({'Execução ROUGE concluída' : executaRouge.success});
                                        
                                        let result = await formataResult(projetoOutput);
                                        console.log({'Resultado formatado' : result.success});                                            
                                            
                                        let json_result = await formatJSON(projetoOutput);
                                        console.log({'JSON_Result' : json_result.success});

                                                    
                                        let resultado = new Resultado({
                                            projeto : projeto,
                                            medidas: json_result.result,                                            
                                        })
                                        resultado.save((err) => {
                                            if(err) console.log(err);
                                                //console.log("Resultado salvo: " + resultado);
                                                console.log({success:true, message: "Resultado gravado corretamente"});
                                                if(req.headers['authorization']){                                         

                                                    res.json({projeto: projeto._id, resultado : resultado.medidas})
                                                 } else    {   
                                                   /* fs.writeFileSync(path.join(process.cwd() +'/' + projetoOutput+'/result.json'), json_result.result, (err)=> {      
                                                    if(err) reject({success: false, message: "Não foi possível gravar o arquivo reference", erro: err});                                                                                         
                                                })    */                   
                                                    res.redirect('/projeto/' + projeto._id);
                                                         }
                                         });                                                               
                                                                        
                            }
                            callRougue().catch(err => console.log(err));     
        })                       
      
    }else{        
        res.json({success : false,message :"Request não disponível. Nome do projeto não pode ser nulo"});
    }
});

         }
 }else{
     res.json({success : false,message :"Não foi possível iniciar o processo"});
 }
}

exports.api_perfil_post = [

    //Se usuário quiser atualizar somente um dos campos
    //Verificar retorno de mais um erro sendo que é o mesmo:
    //Ex: senha menor que 5 caracteres 
    

    body('nome', 'O nome deve ter no mínimo 5 caracteres.').trim().isLength({ min: 5 }).escape(),
    body('nome', 'Nome não pode ser vazio').trim().isLength(0).escape(),
    body('email', 'Email inválido.').trim().isEmail(),
    body('senha', 'Senha inválida. Mínimo 5 caracteres.').trim().isLength({ min: 5 }).escape(),
    body('senha_2', 'Senha inválida. Mínimo 5 caracteres').trim().isLength({ min: 5 }).escape(),
    body('senha', "As senhas não são iguais").custom((value, {req}) => value === req.body.senha_2),

    (req,res,next) =>{
       if(req && req.body && req.headers && req.user.name){      
            const errors = validationResult(req);          
        if(!errors.isEmpty()){                   
            res.render('perfil', {success: false, body: true, message : errors.array()}); 
        }else{    
            var usuario = new Usuario({                
                nome : req.body.nome,
                email : req.body.email,
                senha : md5(req.body.senha),
                _id : req.idUser,
            });
            Usuario.findByIdAndUpdate(req.idUser, usuario, {}, function(err,result){
                if(err) 
                res.render('perfil', {success: false, message : "MongoDB: Ocorreu um erro ao atualizar o perfil!" + err, usuario: usuario})
                console.log(result);
                res.render('perfil', {success: true, message : "Seu perfil foi atualizado!", usuario: usuario})
            });    
    }
} else{
    res.render('perfil', {success: false, message : "Ocorreu um erro ao atualizar o perfil!", usuario: usuario})
}
    }
];

exports.api_sobre = (req,res,next) =>{


            res.render('sobre');


}

exports.api_novo_projeto = (req,res,next) => {



        res.render('rouge_page');



}

function formataData(value){

    
    for(let i=0;i<value.length;i++){
        if(value){
            let data = (value[i].dataCriacao.getDate()<10 ? "0" +value[i].dataCriacao.getDate() : value[i].dataCriacao.getDate())  + "/" + mes[value[i].dataCriacao.getMonth()] + "/" + value[i].dataCriacao.getFullYear()                                                
            console.log(data);
     }
    }
    return value;
   
}

exports.api_projeto = (req,res,next) => {

    if(req.params.id && req.token){
        let idProjeto = req.params.id;    
        Projeto.findOne({'_id': idProjeto}, {nome:1, dataCriacao:1})
         .exec((err, projeto) =>{
            if(projeto!=null && projeto!=undefined){
                console.log("Projeto" + projeto._id);
                Resultado.findOne({'projeto' : projeto})
                .exec((err, resultado) =>{   
                    if(resultado!=null 
                    && resultado!=undefined){  
                                            
                        res.json({projeto: projeto, medidas: resultado});       
                    }else{
                        res.json({success:false, message:"Resultado não encontrado"}).status(404)
                    }        

           });
        }else{
            res.json({success:false, message:"Projeto não encontrado"}).status(404)
        }

    });
    }else{
        res.json({success:false, message:"Identificador não encontrado"}).status(404)
    }
}


exports.api_lista_projetos = (req,res) =>{
    if(req.idUser && req.token){
        let idProjeto = req.params.id;    
        Projeto.find({'usuario': req.idUser}, {nome:1, dataCriacao: 1}).sort({'dataCriacao': 'desc'})
         .exec((err, projeto) =>{
             if(err) res.render('lista_projetos', {success:false, message:"Projeto não encontrado"})
            if(projeto!=null && projeto!=undefined){  
                     
                    res.render('lista_projetos', {success: true, projeto: projeto});             
        }else{
            res.render('lista_projetos', {success:false, message:"Projeto não encontrado"})
        }

    });
    }else{
        res.render('lista_projetos', {success:false, message:"Identificador não encontrado"})
    }           

};



exports.api_projeto_detalhe = (req,res,next) => {
   
    if(req.params.id && req.token){
        let idProjeto = req.params.id;    
        Projeto.findOne({'_id': idProjeto}, {nome:1, dataCriacao:1})
         .exec((err, projeto) =>{
            if(projeto!=null && projeto!=undefined){
               // console.log("Projeto" + projeto._id);
                Resultado.findOne({'projeto' : projeto})
                .exec((err, resultado) =>{   
                    if(resultado!=null 
                    && resultado!=undefined){                    
                        res.render('projeto', {projeto: projeto, medidas: resultado});
                    }else{
                        res.json({success:false, message:"Resultado não encontrado"}).status(404)
                    }        

           });
        }else{
            res.json({success:false, message:"Projeto não encontrado"}).status(404)
        }

    });
    }else{
        res.json({success:false, message:"Identificador não encontrado"}).status(404)
    }
                   
        

};


//Verificar porque função não funciona
function salvaResult(result_json, projeto){
    
    resultado.save((err) => {
          if(err) console.log(err);
          //console.log("Resultado salvo: " + resultado);
         return {success:true, message: "Resultado gravado corretamente"};
        
  }); 
}


//Refatorar
function formataResult(projetoOutput){

    return new Promise(resolve =>{
        try{
            let csv_temp = "";        
            console.log(path.join(process.cwd() +'/' + projetoOutput));
            fs.readFile(path.join(process.cwd() +'/' + projetoOutput+'/result.csv'), 'utf8', (err, data) =>{        
                
                    if(data){
                        csv_temp = data.split("");
                    }
                    
                    for(i=0;i<csv_temp.length;i++) {
                        if((csv_temp[i]=="," && csv_temp[i+1]=="0" && csv_temp[i+2]==",") || 
                        (csv_temp[i]=="," && csv_temp[i+1]=="1" && csv_temp[i+2]==",")) {
                            csv_temp[i+2]=".";
                            }
                        } 
                    csv_temp = csv_temp.join("");
        
                    while(csv_temp.indexOf('\n\n') >-1){
                        csv_temp = csv_temp.replace('\n\n', '\n');
                     }    
                   // console.log(csv_temp);                    
                    
                 fs.writeFile(path.join(process.cwd() +'/' + projetoOutput+'/result.csv'), csv_temp, (err) =>{
                    
                        if(err) {
                            resolve({success: false, message :"Não foi possível gravar o arquivo results", erro : err});
                        }
                    })                  
                                          
                        
                        resolve({success: true, message : "Arquivo result formatado e gravado"});
                        if(err){
                            resolve({success: false, message :"Não foi possível abrir o arquivo results", erro : err});
                        }
                    })
                     
         } catch(err){
            resolve({success: false, message :"Erro ao executar operação de leitura", erro : err});
        }
    }).catch((err) =>{
        resolve({success: false, message :"Não foi possível iniciar o processo", erro: err});

    })
}


//Retorna JSON com resultado do ROUGE
function formatJSON(projetoOutput){
    let result =[];
/// Checkar se req.usuario existe req.projeto e req.session
            return new Promise(resolve => {
                try{
                    //Checar se diretório existe
                    if(projetoOutput){     
                        fs.createReadStream(path.join(process.cwd() +'/' + projetoOutput+'/result.csv'), "utf8")
                            .pipe(csv())
                            .on('data', (jsonObj)=>    
                                results.push(jsonObj)         
                        )
                            .on('end', (err) =>{
                           
                                resolve({ result: results, success: true, message:"Arquivo result-json gerado"}); 

                               

                        }).on('end', (err) =>{
                                results = [];
                        });
                        }
                    }
                        catch(e){
                                console.log(e);
                                resolve({success: false, message: "Arquivo json não gerado"});
                        }       
                
            }).catch(err =>{

                    resolve({success:false, message :"Não possível converter"});
            })

};

exports.api_configuracoes = (req,res,next) => {


    res.render('configuracoes');

}

exports.api_result = (req,res,next) => {       
      
    if(req.params.id!=null 
        && req.params.id!=undefined 
        && req.token){
        let file = path.join(process.cwd() + '/projetos/' +req.params.id + '/results/result.csv');
        res.sendFile(file);         
    }else{
        res.json({success:false, message :"Identificador não encontrado"});
    }

}
