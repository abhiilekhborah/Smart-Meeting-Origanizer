using Microsoft.AspNetCore.Mvc;
using SmartMeet.API.DTOs;
using SmartMeet.API.Services;
namespace SmartMeet.API.Controllers;

[ApiController, Route("api/users")]
public class UsersController(SessionService sessions) : ControllerBase
{
    [HttpGet("me"), ProducesResponseType(typeof(UserResponseDto), 200)]
    public async Task<IActionResult> Me() => Ok(await sessions.Me());
    [HttpPost("heartbeat"), ProducesResponseType(typeof(UserResponseDto), 200)]
    public async Task<IActionResult> Heartbeat() => Ok(await sessions.Heartbeat());
}
