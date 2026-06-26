use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
    version: &'static str,
}

#[derive(Debug, Serialize, Deserialize)]
struct ExportRequest {
    document_id: Uuid,
    pages: Vec<Uuid>,
    quality: String,
    format: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ExportResponse {
    url: String,
    filename: String,
    size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct RenderRequest {
    nodes: Vec<SceneNode>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SceneNode {
    id: Uuid,
    #[serde(rename = "type")]
    node_type: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    fill: Option<String>,
    stroke: Option<Stroke>,
    children: Vec<Uuid>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Stroke {
    color: String,
    width: f64,
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(HealthResponse {
        status: "ok",
        service: "pdf-engine",
        version: "1.0.0",
    })
}

async fn render_nodes(req: web::Json<RenderRequest>) -> HttpResponse {
    // Stub: In production, this would use printpdf or similar
    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "node_count": req.nodes.len(),
    }))
}

async fn export_pdf(req: web::Json<ExportRequest>) -> HttpResponse {
    // Stub: In production, this would generate actual PDF
    HttpResponse::Ok().json(ExportResponse {
        url: format!("/downloads/{}.pdf", req.document_id),
        filename: "document.pdf".to_string(),
        size: 0,
    })
}

async fn export_svg(req: web::Json<ExportRequest>) -> HttpResponse {
    HttpResponse::Ok().json(ExportResponse {
        url: format!("/downloads/{}.svg", req.document_id),
        filename: "document.svg".to_string(),
        size: 0,
    })
}

async fn export_png(req: web::Json<ExportRequest>) -> HttpResponse {
    HttpResponse::Ok().json(ExportResponse {
        url: format!("/downloads/{}.png", req.document_id),
        filename: "document.png".to_string(),
        size: 0,
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt::init();

    println!("PDF Engine starting on port 3001");

    HttpServer::new(|| {
        App::new()
            .wrap(Cors::permissive())
            .route("/health", web::get().to(health))
            .route("/render", web::post().to(render_nodes))
            .route("/export/pdf", web::post().to(export_pdf))
            .route("/export/svg", web::post().to(export_svg))
            .route("/export/png", web::post().to(export_png))
    })
    .bind("0.0.0.0:3001")?
    .run()
    .await
}
