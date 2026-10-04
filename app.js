// Configurações do Supabase obtidas do projeto real do usuário
const SUPABASE_URL = "https://bnpbwxepmzohjcbwvnbs.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_jyC3n7Aahk-KwWsu1FAawQ_Cw6D0tB_";
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

angular.module('blog', ['ngSanitize'])

.controller('Rest', function ($scope, $window) {

    $scope.publicacoes = [];
    $scope.busca = '';
    $scope.carregando = true;
    $scope.erro = false;

    // Abre a publicação em uma nova aba gravando os dados localmente primeiro
    $scope.abrirPost = function (post, $event) {
        if ($event) {
            $event.preventDefault();
        }
        try {
            $window.localStorage.setItem('postSelecionado', JSON.stringify(post));
        } catch (e) {
            console.error('Erro ao salvar no localStorage:', e);
        }
        $window.open('post.html?id=' + post.id, '_blank');
    };

    function processarPosts(dados) {
        var posts = angular.isArray(dados) ? dados : [];

        $scope.publicacoes = posts.map(function (post) {
            // Prioriza image_url do Supabase, seguida por outras variações possíveis
            var imgApi = post.image_url || post.imagem || post.thumbImage || post.urlImagem || post.image || post.thumb || post.thumbnail;

            return {
                id: post.id,
                titulo: post.title || post.titulo || 'Post sem título',
                imagem: (imgApi && imgApi.trim() !== '') ? imgApi : 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=500&q=80',
                conteudo: post.content || post.conteudo || '',
                resumo: post.resumo || post.excerpt || post.description || (post.content || post.conteudo || ''),
                categoria: post.category || post.categoria || 'Geral'
            };
        });

        // Backup das publicações
        try {
            $window.localStorage.setItem('todasPublicacoes', JSON.stringify($scope.publicacoes));
        } catch (e) {}

        $scope.carregando = false;
    }

    // Carregamento via Supabase
    async function carregarDoSupabase() {
        try {
            const { data, error } = await _supabase
                .from('postagens')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            $scope.$applyAsync(function() {
                processarPosts(data || []);
            });
        } catch (err) {
            console.error("Erro ao carregar Supabase:", err);
            $scope.$applyAsync(function() {
                var backup = $window.localStorage.getItem('todasPublicacoes');
                if (backup) {
                    $scope.publicacoes = JSON.parse(backup);
                    $scope.carregando = false;
                } else {
                    $scope.carregando = false;
                    $scope.erro = true;
                }
            });
        }
    }

    carregarDoSupabase();
})

// Página individual do post.
.controller('Post', function ($scope, $sce, $window) {

    $scope.post = null;
    $scope.carregando = true;
    $scope.erro = false;

    function obterId() {
        var urlParams = new URLSearchParams($window.location.search);
        return urlParams.get('id');
    }

    function normalizar(post) {
        var conteudo = post.content || post.conteudo || post.body || post.descricao || '';
        var imgApi = post.image_url || post.imagem || post.thumbImage || post.urlImagem || post.image || post.thumb || post.thumbnail;

        var tagsArray = [];
        if (angular.isArray(post.tags)) {
            tagsArray = post.tags;
        } else if (typeof post.tags === 'string') {
            tagsArray = post.tags.split(',').map(function(t) { return t.trim(); });
        }

        return {
            id: post.id,
            titulo: post.title || post.titulo || 'Post sem título',
            resumo: post.resumo || post.excerpt || post.description || '',
            autor: post.autor || post.author || post.criador || 'Redação',
            data: post.created_at ? new Date(post.created_at).toLocaleDateString('pt-BR') : (post.data || null),
            imagem: (imgApi && imgApi.trim() !== '') ? imgApi : 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=1200&q=80',
            conteudo: conteudo,
            categoria: post.category || post.categoria || (tagsArray.length ? tagsArray[0] : 'Geral'),
            tags: tagsArray
        };
    }

    function exibirPost(post) {
        $scope.post = normalizar(post);
        $scope.post.conteudoHtml = $sce.trustAsHtml($scope.post.conteudo);
        $scope.carregando = false;
    }

    var id = obterId();

    // 1ª Tentativa: Ler o post do localStorage gravado no clique
    var postSalvo = $window.localStorage.getItem('postSelecionado');
    if (postSalvo) {
        try {
            var parsedPost = JSON.parse(postSalvo);
            if (!id || String(parsedPost.id) === String(id)) {
                exibirPost(parsedPost);
                return;
            }
        } catch (e) {}
    }

    // 2ª Tentativa: Buscar no Supabase por ID
    async function buscarPostUnicoSupabase() {
        try {
            const { data, error } = await _supabase
                .from('postagens')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            $scope.$applyAsync(function() {
                if (data) {
                    exibirPost(data);
                } else {
                    $scope.carregando = false;
                    $scope.erro = true;
                }
            });
        } catch (err) {
            console.error("Erro ao buscar post único:", err);
            $scope.$applyAsync(function() {
                var todas = $window.localStorage.getItem('todasPublicacoes');
                if (todas) {
                    var lista = JSON.parse(todas);
                    var doBackup = lista.find(function (p) { return String(p.id) === String(id); });
                    if (doBackup) {
                        exibirPost(doBackup);
                        return;
                    }
                }
                $scope.carregando = false;
                $scope.erro = true;
            });
        }
    }

    if (id) {
        buscarPostUnicoSupabase();
    } else {
        $scope.carregando = false;
        $scope.erro = true;
    }
});

// Funções globais de administração para Incrementar (Criar), Editar e Excluir via Supabase (Console F12) 
// // com atualização automática da interface

window.BlogAdmin = {
    async criar(title, content, category = 'Estudos', image_url = '') {
        const { data, error } = await _supabase.from('postagens').insert([{ title, content, category, image_url }]).select();
        if (error) return console.error(error);
        console.log("Criado com sucesso:", data);
        
        // Atualiza a página automaticamente para refletir na tela
        alert("Post criado com sucesso!");
        window.location.reload();
    },
    async editar(id, updates) {
        const { data, error } = await _supabase.from('postagens').update(updates).eq('id', id).select();
        if (error) return console.error(error);
        console.log("Atualizado com sucesso:", data);
        
        // Atualiza a página automaticamente para refletir na tela
        alert("Post atualizado com sucesso!");
        window.location.reload();
    },
    async deletar(id) {
        const { error } = await _supabase.from('postagens').delete().eq('id', id);
        if (error) return console.error(error);
        console.log("Removido com sucesso");
        
        // Atualiza a página automaticamente para sumir com o card da tela
        alert("Post removido com sucesso!");
        window.location.reload();
    }
};